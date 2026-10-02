import axiosInstance from "./axiosInstance";

export const getTherapistSlots = (slug, days = 14) =>
  axiosInstance.get(`/therapist/${slug}/slots?days=${days}`);

// Booking is two steps: start (we email a code) then verify (the code books it).
// A client already verified on this device passes clientToken to skip the code.
export const startBooking = (slug, data) => axiosInstance.post(`/therapist/${slug}/book/start`, data);
export const verifyBooking = (slug, requestId, code) =>
  axiosInstance.post(`/therapist/${slug}/book/verify`, { requestId, code });
export const resendBookingCode = (slug, requestId) =>
  axiosInstance.post(`/therapist/${slug}/book/resend`, { requestId });
export const cancelBookingRequest = (slug, requestId) =>
  axiosInstance.post(`/therapist/${slug}/book/cancel`, { requestId });

export const verifyPayment = (data) => axiosInstance.post("/payments/verify", data);
export const getPaymentStatus = (orderId) => axiosInstance.get(`/payments/status/${orderId}`);
export const releaseHold = (orderId) => axiosInstance.post("/payments/release", { orderId });

// Public link from the confirmation email; opens without logging in
export const receiptUrl = (token) => `${import.meta.env.VITE_API_BASE_URL}/receipts/${token}`;

// Load Razorpay's checkout script once, on demand
let razorpayScript;
export const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (!razorpayScript) {
    razorpayScript = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => {
        razorpayScript = null;
        resolve(false);
      };
      document.body.appendChild(s);
    });
  }
  return razorpayScript;
};
