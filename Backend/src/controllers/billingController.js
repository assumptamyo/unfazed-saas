import Payment from "../models/Payment.js";
import Therapist from "../models/Therapist.js";
import { paymentsEnabled, isTestMode } from "../services/razorpayService.js";
import { expireStaleHolds, refundSessionPayment } from "../services/paymentService.js";
import { generateReceiptPdf } from "../services/receiptService.js";
import { sendCancellationToClient } from "../services/emailService.js";
import { sendPdf } from "./paymentController.js";
import { toDateKey } from "../utils/dateUtils.js";
import { canAccess, upgradeRequired } from "../services/entitlementService.js";
import Session from "../models/Session.js";

const MAX_FEE_RUPEES = 100000;

const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const serializePayment = (p) => ({
  id: p._id,
  status: p.status,
  amount: p.amount,
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
      "amount status paidAt refund"
    );

    const now = new Date();
    const thisMonth = monthKey(now);
    const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const months = [];
    for (let i = 5; i >= 0; i--) {
      months.push({ month: monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)), collected: 0, refunded: 0 });
    }
    const byMonth = Object.fromEntries(months.map((m) => [m.month, m]));

    const stats = { thisMonth: 0, lastMonth: 0, totalCollected: 0, totalRefunded: 0, paidCount: 0 };
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
      if (key === thisMonth) stats.thisMonth += net;
      if (key === lastMonth) stats.lastMonth += net;
    });

    return res.status(200).json({
      paymentsEnabled: paymentsEnabled(),
      testMode: isTestMode(),
      sessionFee: req.therapist.sessionFee || 0,
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
  const pdf = await generateReceiptPdf({ payment, therapistName: req.therapist.name });
  return sendPdf(res, pdf, `Receipt-${payment.receiptNumber}.pdf`, false);
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
      try {
        await sendCancellationToClient(
          payment.booking.clientEmail,
          payment.booking.clientName,
          req.therapist.name,
          session.date,
          session.startTime,
          session.endTime,
          reason,
          payment.amount
        );
      } catch (emailError) {
        console.error("Refund email failed:", emailError.message);
      }
    }

    return res.status(200).json({ message: "Refund issued", cancelledSession, amount: payment.amount });
  } catch (error) {
    console.error("Refund error:", error.message);
    return res.status(error.statusCode || 500).json({
      message: error.error?.description || "Refund failed. Please try again or refund from the Razorpay dashboard.",
    });
  }
};
