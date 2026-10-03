import crypto from "crypto";
import Client from "../models/Client.js";
import Session from "../models/Session.js";
import Payment from "../models/Payment.js";
import Therapist from "../models/Therapist.js";
import { nextSequence } from "../models/Counter.js";
import { findAvailableSlot } from "./slotService.js";
import { createOrder, fetchPayment, refundPayment, publicKeyId } from "./razorpayService.js";
import { toDateKey } from "../utils/dateUtils.js";
import { publishInBackground, EVENTS } from "./notificationService.js";
import { getTierForTherapist } from "./entitlementService.js";
import { platformFeePercentFor, splitAmount } from "../config/platformFees.js";
import { createClientPackageFromPayment, returnSessionCredit, unusedValue } from "./packageService.js";
import ClientPackage from "../models/ClientPackage.js";

export const HOLD_MINUTES = 15;


// Find the client by email for this therapist, or create them from the booking form
export const upsertClientForBooking = async (therapistId, b) => {
  let client = await Client.findOne({ therapist: therapistId, email: b.clientEmail.toLowerCase() });

  if (!client) {
    return Client.create({
      therapist: therapistId,
      name: b.clientName,
      email: b.clientEmail,
      phone: b.clientPhone || "",
      whatsappOptIn: b.whatsappOptIn !== false,
      intake: {
        demographics: {
          age: b.age || undefined,
          gender: b.gender || "",
          occupation: b.occupation || "",
        },
        presentingConcern: b.presentingConcern || "",
      },
      consent: { agreed: true, agreedAt: new Date() },
    });
  }

  if (!client.consent?.agreed) client.consent = { agreed: true, agreedAt: new Date() };
  // Keep contact details current with what the client entered this time
  if (b.clientPhone) client.phone = b.clientPhone;
  if (b.whatsappOptIn !== undefined) client.whatsappOptIn = b.whatsappOptIn !== false;
  client.archivedAt = null; // booking again brings an archived client back
  await client.save();
  return client;
};

// Start a paid booking: hold the slot and create a Razorpay order for the checkout.
// `pkg` (optional) is a Package being bought together with this first session.
export const startCheckout = async (therapist, booking, pkg = null) => {
  const amount = pkg ? pkg.sessionCount * pkg.pricePerSession : therapist.sessionFee;
  const order = await createOrder({
    amount,
    receipt: `hold_${crypto.randomBytes(6).toString("hex")}`,
    notes: {
      therapist: String(therapist._id),
      date: toDateKey(booking.date),
      time: booking.startTime,
      ...(pkg ? { package: `${pkg.sessionCount} sessions` } : {}),
    },
  });

  const payment = await Payment.create({
    therapist: therapist._id,
    kind: pkg ? "package" : "session",
    packagePurchase: pkg
      ? {
          package: pkg._id,
          sessionCount: pkg.sessionCount,
          pricePerSession: pkg.pricePerSession,
          validityDays: pkg.validityDays,
        }
      : undefined,
    amount,
    razorpayOrderId: order.id,
    holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
    booking,
  });

  // Two clients could pass the availability check at the same instant. The earliest
  // hold wins; a later duplicate is released straight away.
  const earlier = await Payment.findOne({
    _id: { $ne: payment._id },
    therapist: therapist._id,
    status: { $in: ["created", "processing"] },
    holdExpiresAt: { $gt: new Date() },
    "booking.date": booking.date,
    "booking.startTime": booking.startTime,
    createdAt: { $lte: payment.createdAt },
  });
  if (earlier) {
    payment.status = "released";
    await payment.save();
    return null;
  }

  return {
    paymentId: payment._id,
    keyId: publicKeyId(),
    order: { id: order.id, amount: order.amount, currency: order.currency },
    holdExpiresAt: payment.holdExpiresAt,
    therapistName: therapist.name,
    description: pkg ? `${pkg.sessionCount}-session package` : "Therapy session",
    prefill: { name: booking.clientName, email: booking.clientEmail, contact: booking.clientPhone },
  };
};

// Refund all of a payment (or `amount` paise of it, for a partly used package)
const refundWholePayment = async (payment, reason, amount = payment.amount) => {
  const refund = await refundPayment(payment.razorpayPaymentId, amount, { reason });
  payment.status = "refunded";
  payment.refund = {
    razorpayRefundId: refund.id,
    amount,
    reason,
    createdAt: new Date(),
  };
  await payment.save();
  return payment;
};

// Turn a successful payment into a confirmed session. Safe to call more than once
// (from the browser and from the webhook): only one caller gets to process it.
export const finalizePaidBooking = async (razorpayOrderId, razorpayPaymentId) => {
  const payment = await Payment.findOneAndUpdate(
    {
      razorpayOrderId,
      status: { $in: ["created", "expired", "released", "failed"] },
    },
    { $set: { status: "processing", razorpayPaymentId } },
    { new: true }
  );

  if (!payment) {
    // Already handled (or being handled) by another request
    return { payment: await Payment.findOne({ razorpayOrderId }) };
  }

  const therapist = await Therapist.findById(payment.therapist);
  const b = payment.booking;
  const dateKey = toDateKey(b.date);

  try {
    // The hold may have expired while the client was paying; make sure the slot is still free
    const slot = await findAvailableSlot(therapist._id, dateKey, b.startTime, null, payment._id);
    if (!slot) throw Object.assign(new Error("slot taken"), { slotTaken: true });

    const client = await upsertClientForBooking(therapist._id, b);
    const session = await Session.create({
      therapist: therapist._id,
      client: client._id,
      date: b.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      notes: b.notes || "",
    });

    // A package purchase: create the client's package; this first session uses one credit
    let clientPackage = null;
    if (payment.kind === "package") {
      payment.paidAt = new Date();
      clientPackage = await createClientPackageFromPayment(payment, client._id, b.date);
      session.clientPackage = clientPackage._id;
      await session.save();
    }

    let method = "";
    try {
      method = (await fetchPayment(razorpayPaymentId)).method || "";
    } catch {
      /* payment method is only cosmetic on the receipt */
    }

    // Platform commission (by plan) and the therapist's tax details for the invoice
    const tier = await getTierForTherapist(therapist);
    const { platformFee, netAmount } = splitAmount(payment.amount, platformFeePercentFor(tier.key));

    const seq = await nextSequence("receipt");
    payment.set({
      status: "paid",
      paidAt: payment.paidAt || new Date(),
      client: client._id,
      session: session._id,
      clientPackage: clientPackage?._id,
      platformFee,
      netAmount,
      tax: { gstin: therapist.gstin || "", rate: therapist.gstRate || 0 },
      method,
      receiptNumber: `UNF-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`,
      receiptToken: crypto.randomBytes(24).toString("hex"),
    });
    await payment.save();

    // Confirmation with the PDF receipt, therapist email, WhatsApp, bell: all via the NotificationService
    publishInBackground(EVENTS.BOOKING_CONFIRMED, {
      therapistId: therapist._id,
      clientId: client._id,
      sessionId: session._id,
      paymentId: payment._id,
    });

    return { payment, session };
  } catch (error) {
    if (error.slotTaken || error.code === 11000) {
      // Someone else got the slot: give the money back automatically
      try {
        await refundWholePayment(payment, "Slot was taken before the booking could be confirmed");
        publishInBackground(EVENTS.PAYMENT_REFUNDED, {
          therapistId: therapist._id,
          reason: "slot_taken",
          amount: payment.amount,
          clientEmail: b.clientEmail,
          clientName: b.clientName,
          date: dateKey,
          startTime: b.startTime,
        });
      } catch (refundError) {
        console.error("Automatic refund failed:", refundError.message);
        payment.status = "failed";
        payment.failureReason = "Slot taken; automatic refund failed - refund manually from Razorpay";
        await payment.save();
      }
      return { payment, slotTaken: true };
    }

    // Unexpected error: leave the payment marked so it can be retried by the webhook
    payment.status = "failed";
    payment.failureReason = error.message;
    await payment.save();
    throw error;
  }
};

// Make good a session the therapist cancelled: a session booked with a package gets
// its credit back; a session paid on its own is refunded.
// Returns the refunded amount in paise (0 if nothing was refunded in money).
export const refundSessionPayment = async (sessionId, reason) => {
  if (await returnSessionCredit(sessionId)) return 0;
  const payment = await Payment.findOne({ session: sessionId, status: "paid", kind: { $ne: "package" } });
  if (!payment) return 0;
  await refundWholePayment(payment, reason || "Session cancelled by therapist");
  return payment.amount;
};

// Refund what's left of a package: the unused sessions at the per-session rate.
// The package is closed; sessions already booked with it stay booked.
// Returns the refunded amount in paise.
export const refundPackagePayment = async (payment, reason) => {
  const clientPackage = await ClientPackage.findOne({ _id: payment.clientPackage, status: "active" });
  if (!clientPackage) {
    const err = new Error("This package has already been closed");
    err.statusCode = 400;
    throw err;
  }
  const amount = Math.min(unusedValue(clientPackage), payment.amount);
  if (amount < 100) {
    const err = new Error("All sessions in this package have been used, so there's nothing left to refund");
    err.statusCode = 400;
    throw err;
  }
  await refundWholePayment(payment, reason || "Unused package sessions refunded", amount);
  clientPackage.set({ status: "refunded", refundedAt: new Date() });
  await clientPackage.save();
  return amount;
};

// Holds whose time ran out are marked expired so lists stay tidy
export const expireStaleHolds = (therapistId) =>
  Payment.updateMany(
    { therapist: therapistId, status: "created", holdExpiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } }
  );
