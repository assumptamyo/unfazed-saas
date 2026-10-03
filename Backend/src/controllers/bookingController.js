import jwt from "jsonwebtoken";
import Session from "../models/Session.js";
import Therapist from "../models/Therapist.js";
import Client from "../models/Client.js";
import BookingRequest from "../models/BookingRequest.js";
import { findAvailableSlot } from "../services/slotService.js";
import { paymentsEnabled } from "../services/razorpayService.js";
import { startCheckout, upsertClientForBooking } from "../services/paymentService.js";
import { issueClientToken } from "../services/portalService.js";
import {
  generateCode,
  hashCode,
  checkCode,
  resendBlocked,
  CODE_TTL_MINUTES,
} from "../services/codeService.js";
import { dateFromKey, toDateKey } from "../utils/dateUtils.js";
import { canAccess } from "../services/entitlementService.js";
import { publish, publishInBackground, EVENTS } from "../services/notificationService.js";
import { sendVerificationCodeEmail } from "../services/emailService.js";
import { normalizeIndianMobile } from "../utils/phone.js";
import Package from "../models/Package.js";
import { redeemCredit, returnCredit, serializeClientPackage } from "../services/packageService.js";

const slotTakenResponse = (res) =>
  res.status(409).json({ message: "That time is no longer available. Please choose another slot." });

// Therapists must verify their own email before their booking page takes bookings
const findBookableTherapist = async (slug, res) => {
  const therapist = await Therapist.findOne({ slug });
  if (!therapist) {
    res.status(404).json({ message: "Therapist not found" });
    return null;
  }
  if (!therapist.isVerified) {
    res.status(403).json({ message: "This therapist isn't taking online bookings yet." });
    return null;
  }
  return therapist;
};

// A client who verified their email before (and is signed in on this device) can skip the code
const rememberedClient = async (clientToken, therapist, email) => {
  if (!clientToken) return null;
  try {
    const decoded = jwt.verify(clientToken, process.env.JWT_SECRET);
    if (decoded.role !== "client") return null;
    const client = await Client.findById(decoded.clientId);
    const sameTherapist = client && String(client.therapist) === String(therapist._id);
    return sameTherapist && client.email === email.toLowerCase() ? client : null;
  } catch {
    return null;
  }
};

// Create the booking once the client's email is confirmed:
//   - a client with an unused package session books with that credit (no payment)
//   - otherwise paid sessions (or a package, if one was chosen) return a Razorpay checkout
//   - free sessions are confirmed straight away
const completeBooking = async (therapist, booking, res, { packageId } = {}) => {
  const client = await upsertClientForBooking(therapist._id, booking);
  const clientToken = issueClientToken(client);
  const dateKey = toDateKey(booking.date);

  const credit = await redeemCredit(therapist._id, client._id, dateKey);

  if (!credit) {
    // Only charge when the therapist's plan includes online payments
    const charges = therapist.sessionFee > 0 && (await canAccess(therapist, "payments.online")).allowed;

    if (charges) {
      if (!paymentsEnabled()) {
        return res.status(503).json({
          message: "Online payment isn't available right now. Please contact your therapist directly.",
        });
      }
      let pkg = null;
      if (packageId) {
        pkg = await Package.findOne({ _id: packageId, therapist: therapist._id, active: true });
        if (!pkg) {
          return res.status(400).json({ message: "That package is no longer offered. Please choose again." });
        }
      }
      const checkout = await startCheckout(therapist, booking, pkg);
      if (!checkout) return slotTakenResponse(res);
      return res.status(200).json({ requiresPayment: true, checkout, clientToken });
    }
  }

  let session;
  try {
    session = await Session.create({
      therapist: therapist._id,
      client: client._id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      notes: booking.notes,
      clientPackage: credit?._id,
    });
  } catch (error) {
    if (credit) await returnCredit(credit._id);
    throw error;
  }

  // Notifications (emails, WhatsApp, the therapist's bell) are handled by the NotificationService
  publishInBackground(EVENTS.BOOKING_CONFIRMED, {
    therapistId: therapist._id,
    clientId: client._id,
    sessionId: session._id,
  });

  return res.status(201).json({
    message: "Session booked successfully",
    requiresPayment: false,
    clientToken,
    usedPackage: credit ? serializeClientPackage(credit) : null,
    session: {
      id: session._id,
      date: dateKey,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
    },
  });
};

const handleError = (error, res, label) => {
  if (error.code === 11000) {
    return res.status(409).json({ message: "This slot was just booked by someone else. Please choose another time." });
  }
  console.error(`${label}:`, error.message);
  return res.status(error.statusCode || 500).json({ message: "Server error while booking session" });
};

// @desc   Step 1: check the slot and email the client a code (or book straight
//         away for a client already verified on this device)
// @route  POST /api/therapist/:slug/book/start   (public)
export const startBooking = async (req, res) => {
  try {
    const b = req.body;
    if (b.consentAgreed !== true) {
      return res.status(400).json({ message: "Consent is required to book a session" });
    }

    const therapist = await findBookableTherapist(req.params.slug, res);
    if (!therapist) return undefined;

    const dateKey = b.date.slice(0, 10);
    const slot = await findAvailableSlot(therapist._id, dateKey, b.startTime);
    if (!slot) return slotTakenResponse(res);

    const booking = {
      clientName: b.clientName,
      clientEmail: b.clientEmail.toLowerCase(),
      clientPhone: normalizeIndianMobile(b.clientPhone),
      whatsappOptIn: b.whatsappOptIn !== false,
      date: dateFromKey(dateKey),
      startTime: slot.startTime,
      endTime: slot.endTime,
      notes: b.notes || "",
      age: b.age ? Number(b.age) : undefined,
      gender: b.gender || "",
      occupation: b.occupation || "",
      presentingConcern: b.presentingConcern || "",
    };

    // A therapist at their plan's active-client cap can still see existing clients,
    // but can't take on new ones (or bring back archived ones) until they upgrade
    const existingClient = await Client.findOne({ therapist: therapist._id, email: booking.clientEmail });
    if (!existingClient || existingClient.archivedAt) {
      const access = await canAccess(therapist, "clients.active", { adding: 1 });
      if (!access.allowed) {
        return res.status(403).json({
          code: "NOT_ACCEPTING_CLIENTS",
          message: `${therapist.name} isn't taking on new clients right now. If you're an existing client, use the email you booked with before.`,
        });
      }
    }

    const packageId = b.packageId || undefined;
    if (await rememberedClient(b.clientToken, therapist, booking.clientEmail)) {
      return completeBooking(therapist, booking, res, { packageId });
    }

    const code = generateCode();
    const request = await BookingRequest.create({
      therapist: therapist._id,
      booking,
      packageId,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60000),
    });

    try {
      await sendVerificationCodeEmail(booking.clientEmail, booking.clientName, code, "booking", therapist.name);
    } catch (emailError) {
      console.error("Booking code email failed:", emailError.message);
      request.status = "expired"; // release the slot
      await request.save();
      return res.status(502).json({
        message: "We couldn't send a code to that email address. Please check it and try again.",
      });
    }

    return res.status(200).json({
      needsVerification: true,
      requestId: request._id,
      email: booking.clientEmail,
      expiresAt: request.expiresAt,
    });
  } catch (error) {
    return handleError(error, res, "Start booking error");
  }
};

// @desc   Step 2: check the emailed code, then book
// @route  POST /api/therapist/:slug/book/verify   (public)
export const verifyBooking = async (req, res) => {
  try {
    const therapist = await findBookableTherapist(req.params.slug, res);
    if (!therapist) return undefined;

    const request = await BookingRequest.findOne({
      _id: req.body.requestId,
      therapist: therapist._id,
      status: "pending",
    });
    const problem = await checkCode(request, req.body.code);
    if (problem) {
      return res.status(400).json({ message: problem });
    }

    // Atomically claim the request so a double-submit can't book twice
    const claimed = await BookingRequest.findOneAndUpdate(
      { _id: request._id, status: "pending" },
      { $set: { status: "verified" } },
      { new: true }
    );
    if (!claimed) {
      return res.status(409).json({ message: "This booking was already confirmed." });
    }

    // The hold is released now, so re-check the slot before booking
    const slot = await findAvailableSlot(therapist._id, toDateKey(claimed.booking.date), claimed.booking.startTime);
    if (!slot) return slotTakenResponse(res);

    return completeBooking(therapist, claimed.booking.toObject(), res, { packageId: claimed.packageId });
  } catch (error) {
    return handleError(error, res, "Verify booking error");
  }
};

// @desc   Send a new code for a pending booking
// @route  POST /api/therapist/:slug/book/resend   (public)
export const resendBookingCode = async (req, res) => {
  try {
    const therapist = await findBookableTherapist(req.params.slug, res);
    if (!therapist) return undefined;

    const request = await BookingRequest.findOne({
      _id: req.body.requestId,
      therapist: therapist._id,
      status: "pending",
    });
    if (!request) {
      return res.status(404).json({ message: "This booking request has expired. Please pick your time again." });
    }
    const blocked = resendBlocked(request);
    if (blocked) {
      return res.status(429).json({ message: blocked });
    }

    // A new code also extends the slot hold; verifyBooking re-checks the slot anyway
    const code = generateCode();
    request.set({
      codeHash: hashCode(code),
      attempts: 0,
      sends: request.sends + 1,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60000),
    });
    await request.save();
    await sendVerificationCodeEmail(request.booking.clientEmail, request.booking.clientName, code, "booking", therapist.name);

    return res.status(200).json({ message: "A new code is on its way", expiresAt: request.expiresAt });
  } catch (error) {
    return handleError(error, res, "Resend booking code error");
  }
};

// @desc   Abandon a pending booking (e.g. the client typed the wrong email) so the slot frees up
// @route  POST /api/therapist/:slug/book/cancel   (public; the request id is only known to that browser)
export const cancelBookingRequest = async (req, res) => {
  await BookingRequest.updateOne({ _id: req.body.requestId, status: "pending" }, { $set: { status: "expired" } });
  return res.status(200).json({ message: "Released" });
};
