import PDFDocument from "pdfkit";
import Therapist from "../models/Therapist.js";
import ClientPackage from "../models/ClientPackage.js";
import { toDateKey, dateFromKey } from "../utils/dateUtils.js";

const ORANGE = "#D96B00";
const INK = "#2B221E";
const MUTED = "#8A7A6D";
const LINE = "#EFE6DA";
const SOFT = "#FBF8F3";

// SAC heading for human health services
const SAC_CODE = "9993";

// The built-in PDF fonts have no ₹ glyph, so amounts are written as "INR 1,500.00"
export const formatInr = (paise) =>
  `INR ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const money = (paise) =>
  (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (date) =>
  dateFromKey(toDateKey(date)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const METHOD_LABELS = { upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet", emi: "EMI" };

// ---------- amount in words (Indian numbering: thousand, lakh, crore) ----------
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
  "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const belowHundred = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const belowThousand = (n) =>
  n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${belowHundred(n % 100)}` : ""}` : belowHundred(n);

const numberToWords = (n) => {
  if (n === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
};

export const amountInWords = (paise) => {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  return `Rupees ${numberToWords(rupees)}${p ? ` and ${belowHundred(p)} Paise` : ""} Only`;
};

// GST is included in the price: split the amount into taxable value + CGST + SGST
export const taxBreakdown = (amount, rate) => {
  if (!rate) return { taxable: amount, cgst: 0, sgst: 0 };
  const taxable = Math.round((amount * 100) / (100 + rate));
  const gst = amount - taxable;
  const cgst = Math.floor(gst / 2);
  return { taxable, cgst, sgst: gst - cgst };
};

/**
 * A one-page GST-style invoice for a paid session or package.
 * Resolves with the PDF as a Buffer.
 */
export const generateInvoicePdf = ({ payment, therapist, clientPackage = null }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 50;
    const right = doc.page.width - 50;
    const width = right - left;
    const b = payment.booking;
    const rate = payment.tax?.rate || 0;
    const gstin = payment.tax?.gstin || "";
    const { taxable, cgst, sgst } = taxBreakdown(payment.amount, rate);

    // ----- Header -----
    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(11).text("UNFAZED", left, 50, { characterSpacing: 2 });
    doc.fillColor(INK).font("Helvetica").fontSize(24).text(rate ? "Tax invoice" : "Invoice", left, 72);

    const refunded = payment.status === "refunded";
    doc.roundedRect(right - 100, 76, 100, 24, 12).fill(refunded ? "#FDECEA" : "#EEF3F0");
    doc
      .fillColor(refunded ? "#9C3B2E" : "#4F7161")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(refunded ? "REFUNDED" : "PAID", right - 100, 83, { width: 100, align: "center" });

    // ----- Invoice details (left) and parties (right) -----
    let y = 125;
    const meta = [
      ["Invoice no.", payment.receiptNumber || "-"],
      ["Invoice date", payment.paidAt ? formatDate(payment.paidAt) : "-"],
      ["Payment method", METHOD_LABELS[payment.method] || payment.method || "Online"],
      ["Transaction ID", payment.razorpayPaymentId || "-"],
      ["Place of supply", "India"],
    ];
    meta.forEach(([label, value]) => {
      doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(label.toUpperCase(), left, y, { characterSpacing: 0.4 });
      doc.fillColor(INK).font("Helvetica").fontSize(10).text(value, left + 105, y - 1, { width: 160 });
      y += 17;
    });

    const colX = left + width / 2 + 10;
    const colW = width / 2 - 10;
    let py = 125;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text("FROM", colX, py, { characterSpacing: 0.4 });
    py += 13;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(therapist?.name || "Your therapist", colX, py, { width: colW });
    py += 15;
    doc.fillColor(MUTED).font("Helvetica").fontSize(9.5);
    if (therapist?.email) {
      doc.text(therapist.email, colX, py, { width: colW });
      py += 13;
    }
    doc.text(gstin ? `GSTIN: ${gstin}` : "GSTIN: Not registered", colX, py, { width: colW });

    py += 24;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text("BILLED TO", colX, py, { characterSpacing: 0.4 });
    py += 13;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(b.clientName, colX, py, { width: colW });
    py += 15;
    doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(b.clientEmail, colX, py, { width: colW });
    if (b.clientPhone) {
      py += 13;
      doc.text(b.clientPhone, colX, py, { width: colW });
    }

    // ----- Line items -----
    y = Math.max(y, py) + 30;
    const isPackage = payment.kind === "package";
    const qty = isPackage ? payment.packagePurchase?.sessionCount || 1 : 1;
    const cols = { no: left + 10, desc: left + 34, sac: left + 250, qty: left + 292, rate: left + 318, amt: right - 90 };

    doc.roundedRect(left, y, width, 26, 6).fill(SOFT);
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8.5);
    doc.text("#", cols.no, y + 9);
    doc.text("DESCRIPTION", cols.desc, y + 9);
    doc.text("SAC", cols.sac, y + 9);
    doc.text("QTY", cols.qty, y + 9);
    doc.text("RATE", cols.rate, y + 9, { width: 80, align: "right" });
    doc.text("TAXABLE VALUE", cols.amt - 10, y + 9, { width: 90, align: "right" });

    y += 38;
    const description = isPackage ? `${qty}-session therapy package` : "Therapy session (video)";
    const detail = isPackage
      ? `First session ${formatDate(b.date)}, ${b.startTime}${clientPackage ? ` · valid until ${formatDate(clientPackage.expiresAt)}` : ""}`
      : `${formatDate(b.date)}, ${b.startTime} - ${b.endTime}`;
    doc.fillColor(INK).font("Helvetica").fontSize(10);
    doc.text("1", cols.no, y);
    doc.text(description, cols.desc, y, { width: 205 });
    doc.text(SAC_CODE, cols.sac, y);
    doc.text(String(qty), cols.qty, y);
    doc.text(money(Math.round(taxable / qty)), cols.rate, y, { width: 80, align: "right" });
    doc.text(money(taxable), cols.amt - 10, y, { width: 90, align: "right" });
    doc.fillColor(MUTED).fontSize(8.5).text(detail, cols.desc, y + 14, { width: 205 });

    // ----- Totals -----
    y += 44;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 12;
    const totalsX = left + width / 2;
    const row = (label, value, opts = {}) => {
      doc
        .fillColor(opts.color || INK)
        .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opts.size || 10)
        .text(label, totalsX, y, { width: 150 });
      doc.text(value, right - 150, y, { width: 140, align: "right" });
      y += opts.gap || 18;
    };
    row("Taxable value", formatInr(taxable));
    if (rate) {
      row(`CGST @ ${rate / 2}%`, formatInr(cgst));
      row(`SGST @ ${rate / 2}%`, formatInr(sgst));
    } else {
      row("GST", "Not charged", { color: MUTED });
    }
    y += 4;
    doc.moveTo(totalsX, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 10;
    row("Total", formatInr(payment.amount), { bold: true, size: 12, gap: 22 });
    if (refunded && payment.refund?.amount) {
      row("Refunded", `- ${formatInr(payment.refund.amount)}`, { color: "#9C3B2E" });
    }

    // Amount in words
    y += 6;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text("AMOUNT IN WORDS", left, y, { characterSpacing: 0.4 });
    doc.fillColor(INK).fontSize(10).text(amountInWords(payment.amount), left, y + 13, { width });

    if (!rate) {
      doc
        .fillColor(MUTED)
        .fontSize(8.5)
        .text("No GST has been charged on this supply.", left, y + 32, { width });
    }

    // ----- Footer -----
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8.5)
      .text(
        "This is a computer-generated invoice and does not need a signature. Payment processed securely by Razorpay. " +
          "For questions about your sessions, please contact your therapist.",
        left,
        doc.page.height - 100,
        { width, align: "center" }
      );

    doc.end();
  });

// Load what the invoice needs for a payment and build it
export const invoicePdfForPayment = async (payment) => {
  const [therapist, clientPackage] = await Promise.all([
    Therapist.findById(payment.therapist).select("name email"),
    payment.clientPackage ? ClientPackage.findById(payment.clientPackage) : null,
  ]);
  return generateInvoicePdf({ payment, therapist, clientPackage });
};

export const invoiceFileName = (payment) => `Invoice-${payment.receiptNumber}.pdf`;
