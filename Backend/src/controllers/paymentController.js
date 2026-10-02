import Payment from "../models/Payment.js";
import Therapist from "../models/Therapist.js";
import { verifyCheckoutSignature, verifyWebhookSignature } from "../services/razorpayService.js";
import { finalizePaidBooking } from "../services/paymentService.js";
import { generateReceiptPdf } from "../services/receiptService.js";
import { toDateKey } from "../utils/dateUtils.js";

// What the booking page needs to show after checkout
const publicStatus = (payment) => ({
  status: payment.status,
  amount: payment.amount,
  date: toDateKey(payment.booking.date),
  startTime: payment.booking.startTime,
  endTime: payment.booking.endTime,
  receiptNumber: payment.receiptNumber || null,
  receiptToken: payment.status === "paid" || payment.status === "refunded" ? payment.receiptToken || null : null,
});

// @desc   Confirm a booking after Razorpay checkout succeeds in the browser
// @route  POST /api/payments/verify   (public)
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;

    if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
      return res.status(400).json({ message: "Payment could not be verified" });
    }

    const result = await finalizePaidBooking(orderId, paymentId);
    if (!result.payment) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (result.slotTaken) {
      return res.status(409).json({
        message: "Sorry — this time was booked by someone else while you were paying. Your payment has been fully refunded.",
        payment: publicStatus(result.payment),
      });
    }

    return res.status(200).json({ message: "Payment successful", payment: publicStatus(result.payment) });
  } catch (error) {
    console.error("Verify payment error:", error.message);
    return res.status(500).json({
      message: "Your payment went through but we couldn't confirm the booking yet. We'll email you shortly.",
    });
  }
};

// @desc   Poll the state of a checkout (used while confirmation is still processing)
// @route  GET /api/payments/status/:orderId   (public)
export const getPaymentStatus = async (req, res) => {
  const payment = await Payment.findOne({ razorpayOrderId: req.params.orderId });
  if (!payment) {
    return res.status(404).json({ message: "Booking not found" });
  }
  return res.status(200).json({ payment: publicStatus(payment) });
};

// @desc   Release a slot hold when the client closes checkout without paying
// @route  POST /api/payments/release   (public)
export const releaseHold = async (req, res) => {
  await Payment.updateOne({ razorpayOrderId: req.body.orderId, status: "created" }, { $set: { status: "released" } });
  return res.status(200).json({ message: "Released" });
};

// @desc   Razorpay webhook: confirms bookings even if the client's browser closed
// @route  POST /api/payments/webhook   (public, signed by Razorpay)
export const handleWebhook = async (req, res) => {
  if (!verifyWebhookSignature(req.rawBody, req.get("x-razorpay-signature"))) {
    return res.status(400).json({ message: "Invalid signature" });
  }

  try {
    const { event, payload } = req.body;
    const entity = payload?.payment?.entity;

    if ((event === "payment.captured" || event === "order.paid") && entity?.order_id) {
      await finalizePaidBooking(entity.order_id, entity.id);
    } else if (event === "payment.failed" && entity?.order_id) {
      await Payment.updateOne(
        { razorpayOrderId: entity.order_id, status: "created" },
        { $set: { failureReason: entity.error_description || "Payment failed" } }
      );
    }
  } catch (error) {
    // Respond 500 so Razorpay retries the webhook later
    console.error("Webhook error:", error.message);
    return res.status(500).json({ message: "Webhook processing failed" });
  }

  return res.status(200).json({ received: true });
};

const sendPdf = (res, pdf, filename, inline = true) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  return res.send(pdf);
};

// @desc   Download a receipt with the secret link from the confirmation email
// @route  GET /api/receipts/:token   (public, token is unguessable)
export const getPublicReceipt = async (req, res) => {
  const payment = await Payment.findOne({
    receiptToken: req.params.token,
    status: { $in: ["paid", "refunded"] },
  });
  if (!payment) {
    return res.status(404).json({ message: "Receipt not found" });
  }
  const therapist = await Therapist.findById(payment.therapist).select("name");
  const pdf = await generateReceiptPdf({ payment, therapistName: therapist?.name || "Your therapist" });
  return sendPdf(res, pdf, `Receipt-${payment.receiptNumber}.pdf`);
};

export { sendPdf };
