import PDFDocument from "pdfkit";
import { toDateKey, dateFromKey } from "../utils/dateUtils.js";

const ORANGE = "#D96B00";
const INK = "#2B221E";
const MUTED = "#8A7A6D";
const LINE = "#EFE6DA";

// The built-in PDF fonts have no ₹ glyph, so amounts are written as "INR 1,500.00"
export const formatInr = (paise) =>
  `INR ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (date) =>
  dateFromKey(toDateKey(date)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const METHOD_LABELS = { upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet", emi: "EMI" };

// Builds a one-page payment receipt and resolves with the PDF as a Buffer
export const generateReceiptPdf = ({ payment, therapistName }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 56;
    const right = doc.page.width - 56;
    const b = payment.booking;

    // Header
    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(11).text("UNFAZED", left, 56, { characterSpacing: 2 });
    doc.fillColor(INK).font("Helvetica").fontSize(24).text("Payment receipt", left, 80);

    const status = payment.status === "refunded" ? "REFUNDED" : "PAID";
    doc
      .roundedRect(right - 90, 82, 90, 24, 12)
      .fill(status === "PAID" ? "#EEF3F0" : "#FDECEA");
    doc
      .fillColor(status === "PAID" ? "#4F7161" : "#9C3B2E")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(status, right - 90, 89, { width: 90, align: "center" });

    // Meta
    let y = 135;
    const meta = [
      ["Receipt number", payment.receiptNumber || "-"],
      ["Date paid", payment.paidAt ? formatDate(payment.paidAt) : "-"],
      ["Payment method", METHOD_LABELS[payment.method] || payment.method || "Online"],
      ["Payment ID", payment.razorpayPaymentId || "-"],
    ];
    meta.forEach(([label, value]) => {
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(label.toUpperCase(), left, y, { characterSpacing: 0.5 });
      doc.fillColor(INK).font("Helvetica").fontSize(11).text(value, left + 150, y - 1);
      y += 20;
    });

    // Parties
    y += 15;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 18;
    const col = (right - left) / 2;
    doc.fillColor(MUTED).fontSize(9).text("BILLED TO", left, y, { characterSpacing: 0.5 });
    doc.text("PROVIDER", left + col, y, { characterSpacing: 0.5 });
    y += 14;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(b.clientName, left, y, { width: col - 10 });
    doc.text(therapistName, left + col, y, { width: col - 10 });
    y += 17;
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(b.clientEmail, left, y, { width: col - 10 });
    doc.text("via Unfazed", left + col, y);

    // Line item
    y += 40;
    doc.roundedRect(left, y, right - left, 28, 6).fill("#FBF8F3");
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9);
    doc.text("DESCRIPTION", left + 14, y + 10);
    doc.text("AMOUNT", right - 134, y + 10, { width: 120, align: "right" });
    y += 40;
    doc.fillColor(INK).font("Helvetica").fontSize(11).text("Therapy session", left + 14, y);
    doc.text(formatInr(payment.amount), right - 134, y, { width: 120, align: "right" });
    y += 16;
    doc
      .fillColor(MUTED)
      .fontSize(9)
      .text(`${formatDate(b.date)}, ${b.startTime} - ${b.endTime}`, left + 14, y);

    // Totals
    y += 34;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 14;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text("Total paid", left + 14, y);
    doc.text(formatInr(payment.amount), right - 174, y, { width: 160, align: "right" });

    if (payment.status === "refunded" && payment.refund?.amount) {
      y += 24;
      doc.fillColor("#9C3B2E").font("Helvetica").fontSize(11).text("Refunded", left + 14, y);
      doc.text(`- ${formatInr(payment.refund.amount)}`, right - 174, y, { width: 160, align: "right" });
    }

    // Footer
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text(
        "This is a computer-generated receipt for an online payment processed securely by Razorpay. " +
          "For questions about this session, please contact your therapist.",
        left,
        doc.page.height - 110,
        { width: right - left, align: "center" }
      );

    doc.end();
  });
