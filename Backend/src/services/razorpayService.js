import crypto from "crypto";
import Razorpay from "razorpay";

// Keys come from .env:
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET  (Dashboard → Account & Settings → API Keys)
//   RAZORPAY_WEBHOOK_SECRET                (Dashboard → Webhooks, optional but recommended)
let client = null;

export const paymentsEnabled = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export const isTestMode = () => (process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_");

export const publicKeyId = () => process.env.RAZORPAY_KEY_ID;

const getClient = () => {
  if (!paymentsEnabled()) {
    const err = new Error("Online payments are not configured");
    err.statusCode = 503;
    throw err;
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
};

const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

const hmac = (secret, payload) => crypto.createHmac("sha256", secret).update(payload).digest("hex");

export const createOrder = ({ amount, receipt, notes }) =>
  getClient().orders.create({ amount, currency: "INR", receipt, notes });

// Checkout returns order_id, payment_id and signature; the signature proves Razorpay sent them
export const verifyCheckoutSignature = (orderId, paymentId, signature) =>
  paymentsEnabled() &&
  safeEqual(hmac(process.env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), signature);

export const verifyWebhookSignature = (rawBody, signature) =>
  Boolean(process.env.RAZORPAY_WEBHOOK_SECRET) &&
  safeEqual(hmac(process.env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);

export const fetchPayment = (paymentId) => getClient().payments.fetch(paymentId);

export const refundPayment = (paymentId, amount, notes = {}) =>
  getClient().payments.refund(paymentId, { amount, speed: "normal", notes });
