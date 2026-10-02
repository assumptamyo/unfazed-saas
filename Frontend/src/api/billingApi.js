import axiosInstance from "./axiosInstance";

export const getBillingSummary = () => axiosInstance.get("/billing/summary");
export const updateSessionFee = (sessionFee) => axiosInstance.put("/billing/fee", { sessionFee });
export const getPayments = (params = {}) => axiosInstance.get("/billing/payments", { params });
export const refundPayment = (id, reason) => axiosInstance.post(`/billing/payments/${id}/refund`, { reason });

// Receipts need the login token, so fetch as a file and hand it to the browser
export const downloadReceipt = async (id, receiptNumber) => {
  const res = await axiosInstance.get(`/billing/payments/${id}/receipt`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Receipt-${receiptNumber || id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const formatRupees = (paise) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
