import Payment from "../models/Payment.js";
import Therapist from "../models/Therapist.js";
import { paymentsEnabled, isTestMode } from "../services/razorpayService.js";
import { expireStaleHolds, refundSessionPayment, refundPackagePayment } from "../services/paymentService.js";
import Package, { PACKAGE_SIZES } from "../models/Package.js";
import { DEFAULT_VALIDITY_DAYS, serializePackage, serializeClientPackage } from "../services/packageService.js";
import { getTierForTherapist } from "../services/entitlementService.js";
import { platformFeePercentFor } from "../config/platformFees.js";
import { invoicePdfForPayment, invoiceFileName } from "../services/invoiceService.js";
import { sendPdf } from "./paymentController.js";
import { toDateKey } from "../utils/dateUtils.js";
import { canAccess, upgradeRequired } from "../services/entitlementService.js";
import { publish, publishInBackground, EVENTS } from "../services/notificationService.js";
import Session from "../models/Session.js";

const MAX_FEE_RUPEES = 100000;

const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const serializePayment = (p) => ({
  id: p._id,
  status: p.status,
  kind: p.kind || "session",
  packageSessions: p.kind === "package" ? p.packagePurchase?.sessionCount || null : null,
  clientPackage: p.clientPackage?.sessionsTotal ? serializeClientPackage(p.clientPackage) : null,
  amount: p.amount,
  platformFee: p.platformFee || 0,
  netAmount: p.netAmount ?? p.amount - (p.platformFee || 0),
  method: p.method,
  paidAt: p.paidAt || null,
  createdAt: p.createdAt,
  receiptNumber: p.receiptNumber || null,
  razorpayPaymentId: p.razorpayPaymentId || null,
  failureReason: p.failureReason || "",
  refund: p.refund?.createdAt ? { amount: p.refund.amount, reason: p.refund.reason, createdAt: p.refund.createdAt } : null,
  sessionId: p.session?._id || p.session || null,
  sessionStatus: p.session?.status || null,
  client: { id: p.client?._id || null, name: p.client?.name || p.booking.clientName, email: p.booking.clientEmail },
  date: toDateKey(p.booking.date),
  startTime: p.booking.startTime,
  endTime: p.booking.endTime,
});

// @desc   Fee, gateway status, and revenue numbers for the billing page
// @route  GET /api/billing/summary
export const getBillingSummary = async (req, res) => {
  try {
    const therapistId = req.therapist._id;
    const settled = await Payment.find({ therapist: therapistId, status: { $in: ["paid", "refunded"] } }).select(
      "amount status paidAt refund platformFee"
    );

    const now = new Date();
    const thisMonth = monthKey(now);
    const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const months = [];
    for (let i = 5; i >= 0; i--) {
      months.push({ month: monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)), collected: 0, refunded: 0 });
    }
    const byMonth = Object.fromEntries(months.map((m) => [m.month, m]));

    const stats = { thisMonth: 0, lastMonth: 0, totalCollected: 0, totalRefunded: 0, paidCount: 0, platformFees: 0, netEarnings: 0 };
    settled.forEach((p) => {
      const key = monthKey(p.paidAt);
      stats.totalCollected += p.amount;
      stats.paidCount += 1;
      if (byMonth[key]) byMonth[key].collected += p.amount;
      const refunded = p.status === "refunded" ? p.refund?.amount || p.amount : 0;
      stats.totalRefunded += refunded;
      if (refunded && byMonth[monthKey(p.refund?.createdAt || p.paidAt)]) {
        byMonth[monthKey(p.refund?.createdAt || p.paidAt)].refunded += refunded;
      }
      const net = p.amount - refunded;
      // The platform fee shrinks in proportion to what was refunded
      const fee = Math.round((p.platformFee || 0) * (net / p.amount));
      stats.platformFees += fee;
      stats.netEarnings += net - fee;
      if (key === thisMonth) stats.thisMonth += net;
      if (key === lastMonth) stats.lastMonth += net;
    });

    const tier = await getTierForTherapist(req.therapist);
    return res.status(200).json({
      paymentsEnabled: paymentsEnabled(),
      testMode: isTestMode(),
      sessionFee: req.therapist.sessionFee || 0,
      platformFeePercent: platformFeePercentFor(tier.key),
      invoice: { gstin: req.therapist.gstin || "", gstRate: req.therapist.gstRate || 0 },
      stats,
      monthly: months,
    });
  } catch (error) {
    console.error("Billing summary error:", error.message);
    return res.status(500).json({ message: "Server error while loading billing" });
  }
};

// @desc   Set the session fee (in rupees; 0 makes booking free)
// @route  PUT /api/billing/fee
export const updateSessionFee = async (req, res) => {
  try {
    const rupees = Number(req.body.sessionFee);
    if (!Number.isFinite(rupees) || rupees < 0 || rupees > MAX_FEE_RUPEES || (rupees > 0 && rupees < 1)) {
      return res.status(400).json({ message: `Enter a fee between ₹1 and ₹${MAX_FEE_RUPEES.toLocaleString("en-IN")}, or 0 for free` });
    }
    if (rupees > 0) {
      const access = await canAccess(req.therapist, "payments.online");
      if (!access.allowed) return upgradeRequired(res, access);
    }
    if (rupees > 0 && !paymentsEnabled()) {
      return res.status(400).json({ message: "Online payments aren't set up yet, so the fee must stay at 0 for now" });
    }

    const therapist = await Therapist.findByIdAndUpdate(
      req.therapist._id,
      { sessionFee: Math.round(rupees * 100) },
      { new: true }
    ).select("sessionFee");

    return res.status(200).json({ message: "Session fee updated", sessionFee: therapist.sessionFee });
  } catch (error) {
    console.error("Update fee error:", error.message);
    return res.status(500).json({ message: "Server error while updating fee" });
  }
};

// @desc   Payment history
// @route  GET /api/billing/payments?status=paid|refunded|failed
export const getPayments = async (req, res) => {
  try {
    await expireStaleHolds(req.therapist._id);
    const { status } = req.query;
    const query = {
      therapist: req.therapist._id,
      status: status ? status : { $in: ["paid", "refunded", "failed", "processing"] },
    };
    const payments = await Payment.find(query)
      .populate("client", "name")
      .populate("session", "status")
      .populate("clientPackage")
      .sort({ createdAt: -1 })
      .limit(500);

    return res.status(200).json({ payments: payments.map(serializePayment) });
  } catch (error) {
    console.error("Get payments error:", error.message);
    return res.status(500).json({ message: "Server error while fetching payments" });
  }
};

// @desc   Download a receipt
// @route  GET /api/billing/payments/:id/receipt
export const downloadReceipt = async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    therapist: req.therapist._id,
    status: { $in: ["paid", "refunded"] },
  });
  if (!payment) {
    return res.status(404).json({ message: "Receipt not found" });
  }
  const pdf = await invoicePdfForPayment(payment);
  return sendPdf(res, pdf, invoiceFileName(payment), false);
};

// @desc   Refund a payment. If its session is still upcoming, the session is cancelled too.
// @route  POST /api/billing/payments/:id/refund
export const refundPaymentById = async (req, res) => {
  try {
    const reason = String(req.body.reason || "").trim().slice(0, 500);
    const payment = await Payment.findOne({ _id: req.params.id, therapist: req.therapist._id });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    if (payment.status !== "paid") {
      return res.status(400).json({ message: "Only completed payments can be refunded" });
    }

    // A package: refund the sessions that haven't been used; booked sessions stay booked
    if (payment.kind === "package") {
      const amount = await refundPackagePayment(payment, reason || "Unused package sessions refunded");
      return res.status(200).json({ message: "Refund issued", cancelledSession: false, amount });
    }

    await refundSessionPayment(payment.session, reason || "Refunded by therapist");

    // A refunded session shouldn't stay booked if it hasn't happened yet
    let cancelledSession = false;
    const session = payment.session ? await Session.findById(payment.session) : null;
    if (session?.status === "confirmed") {
      session.status = "cancelled";
      session.statusUpdatedAt = new Date();
      session.cancellation = { cancelledAt: new Date(), cancelledBy: "therapist", reason };
      await session.save();
      cancelledSession = true;
      await publish(EVENTS.SESSION_CANCELLED, {
        therapistId: req.therapist._id,
        clientId: session.client,
        sessionId: session._id,
        reason,
        refundAmount: payment.amount,
      });
    }

    return res.status(200).json({ message: "Refund issued", cancelledSession, amount: payment.amount });
  } catch (error) {
    console.error("Refund error:", error.message);
    return res.status(error.statusCode || 500).json({
      message: error.error?.description || "Refund failed. Please try again or refund from the Razorpay dashboard.",
    });
  }
};

// @desc   The therapist's package offers: one row per size (3/6/12), created on first save
// @route  GET /api/billing/packages
export const getPackages = async (req, res) => {
  const saved = await Package.find({ therapist: req.therapist._id });
  const bySize = Object.fromEntries(saved.map((p) => [p.sessionCount, p]));
  const packages = PACKAGE_SIZES.map((size) =>
    bySize[size]
      ? serializePackage(bySize[size])
      : {
          id: null,
          sessionCount: size,
          pricePerSession: req.therapist.sessionFee || 0,
          totalPrice: size * (req.therapist.sessionFee || 0),
          validityDays: DEFAULT_VALIDITY_DAYS[size],
          active: false,
        }
  );
  return res.status(200).json({ packages, sessionFee: req.therapist.sessionFee || 0 });
};

// @desc   Turn a package on/off or change its price and validity
// @route  PUT /api/billing/packages/:size   body: { active, pricePerSession (rupees), validityDays }
export const savePackage = async (req, res) => {
  try {
    const size = Number(req.params.size);
    const { active, validityDays } = req.body;
    const pricePerSession = Math.round(Number(req.body.pricePerSession) * 100);

    if (active) {
      const access = await canAccess(req.therapist, "payments.online");
      if (!access.allowed) return upgradeRequired(res, access);
      if (!req.therapist.sessionFee) {
        return res.status(400).json({ message: "Set a session fee first — packages are offered alongside paid sessions" });
      }
      if (pricePerSession > req.therapist.sessionFee) {
        return res.status(400).json({ message: "A package price per session can't be higher than your single-session fee" });
      }
    }

    const pkg = await Package.findOneAndUpdate(
      { therapist: req.therapist._id, sessionCount: size },
      { $set: { active: Boolean(active), pricePerSession, validityDays } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({ message: active ? "Package is live" : "Package turned off", package: serializePackage(pkg) });
  } catch (error) {
    console.error("Save package error:", error.message);
    return res.status(500).json({ message: "Server error while saving the package" });
  }
};

// @desc   GST details printed on invoices
// @route  PUT /api/billing/invoice-settings   body: { gstin, gstRate }
export const updateInvoiceSettings = async (req, res) => {
  const gstin = String(req.body.gstin || "").trim().toUpperCase();
  const gstRate = Number(req.body.gstRate) || 0;
  if (gstRate > 0 && !gstin) {
    return res.status(400).json({ message: "Add your GSTIN to charge GST" });
  }
  const therapist = await Therapist.findByIdAndUpdate(
    req.therapist._id,
    { gstin, gstRate },
    { new: true, runValidators: true }
  ).select("gstin gstRate");
  return res.status(200).json({ message: "Invoice details saved", invoice: { gstin: therapist.gstin, gstRate: therapist.gstRate } });
};
