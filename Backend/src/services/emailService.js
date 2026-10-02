import nodemailer from "nodemailer";
import escapeHtml from "../utils/escapeHtml.js";
import { toDateKey, dateFromKey } from "../utils/dateUtils.js";

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT == 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

const fromAddress = () => `"Unfazed" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`;

// "2026-10-14" or a stored Date -> "Wednesday, October 14, 2026"
const formatDate = (date) => {
  const key = typeof date === "string" ? date.slice(0, 10) : toDateKey(date);
  return dateFromKey(key).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

// Shared wrapper so every email looks the same. `body` must already be escaped.
const layout = (body) => `
  <div style="font-family: Inter, Arial, sans-serif; background:#F9F6F0; padding:32px 16px;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border:1px solid #EFE6DA; border-radius:16px; padding:28px; color:#2B221E;">
      <p style="margin:0 0 20px; color:#D96B00; font-size:12px; font-weight:600; letter-spacing:2px; text-transform:uppercase;">Unfazed</p>
      ${body}
    </div>
  </div>
`;

const sessionBlock = (date, startTime, endTime, label = "") => `
  <div style="background:#FBF8F3; border:1px solid #EFE6DA; border-radius:12px; padding:14px 16px; margin:16px 0;">
    ${label ? `<p style="margin:0 0 4px; font-size:12px; color:#A89C8F;">${label}</p>` : ""}
    <p style="margin:0; font-weight:600;">${escapeHtml(formatDate(date))}</p>
    <p style="margin:2px 0 0; color:#6B6059;">${escapeHtml(startTime)} – ${escapeHtml(endTime)}</p>
  </div>
`;

const send = (to, subject, body, attachments = []) =>
  getTransporter().sendMail({ from: fromAddress(), to, subject, html: layout(body), attachments });

const rupees = (paise) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0 })}`;

export const verifyEmailService = async () => {
  try {
    await getTransporter().verify();
    console.log("Email service ready");
  } catch (error) {
    console.error("Email service connection failed:", error.message);
  }
};

export const sendWelcomeEmail = async (to, name) => {
  await send(
    to,
    "Welcome to Unfazed",
    `
      <h2 style="margin:0 0 12px;">Welcome, ${escapeHtml(name)}!</h2>
      <p>Your Unfazed account has been created successfully.</p>
      <p>You can now set up your profile and start managing your practice.</p>
    `
  );
  console.log(`Welcome email sent to ${to}`);
};

export const sendOtpEmail = async (to, name, otp, purpose) => {
  const isReset = purpose === "password_reset";
  await send(
    to,
    isReset ? "Reset Your Password - OTP" : "Verify Your Email - OTP",
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(name)},</h2>
      <p>${isReset ? "Use the OTP below to reset your password." : "Use the OTP below to verify your email address."}</p>
      <h1 style="letter-spacing:6px; color:#D96B00;">${escapeHtml(otp)}</h1>
      <p>This OTP will expire in 10 minutes.</p>
      <p style="color:#A89C8F; font-size:13px;">If you did not request this, please ignore this email.</p>
    `
  );
};

const button = (url, label) => `
  <p style="margin:20px 0;">
    <a href="${escapeHtml(url)}" style="display:inline-block; background:#211A16; color:#ffffff; text-decoration:none; font-weight:600; padding:12px 22px; border-radius:999px;">${label}</a>
  </p>`;

// `payment` is optional: { amount, receiptNumber, receiptUrl, pdf }
// `portalUrl` is the client's private link to join the video session and message their therapist
export const sendBookingConfirmationToClient = async (
  to,
  clientName,
  therapistName,
  date,
  startTime,
  endTime,
  payment = null,
  portalUrl = null
) => {
  const paymentBlock = payment
    ? `
      <div style="border:1px solid #D7E5DC; background:#EEF3F0; border-radius:12px; padding:14px 16px; margin:16px 0;">
        <p style="margin:0; font-weight:600; color:#4F7161;">Payment received · ${escapeHtml(rupees(payment.amount))}</p>
        <p style="margin:4px 0 0; font-size:13px; color:#6B6059;">
          Receipt ${escapeHtml(payment.receiptNumber)} is attached.
          ${payment.receiptUrl ? `You can also <a href="${escapeHtml(payment.receiptUrl)}" style="color:#D96B00;">download it here</a>.` : ""}
        </p>
      </div>`
    : "";

  await send(
    to,
    `Session confirmed with ${therapistName}`,
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(clientName)},</h2>
      <p>Your session with <strong>${escapeHtml(therapistName)}</strong> has been confirmed.</p>
      ${sessionBlock(date, startTime, endTime)}
      ${paymentBlock}
      <p>This is a <strong>video session</strong>. When it's time, join from your private client space —
      the room opens 10 minutes before the start. You can also message your therapist there.</p>
      ${portalUrl ? button(portalUrl, "Open your client space") : ""}
      <p style="color:#A89C8F; font-size:13px;">Keep this email private: the button is your personal link.</p>
    `,
    payment?.pdf ? [{ filename: `Receipt-${payment.receiptNumber}.pdf`, content: payment.pdf }] : []
  );
};

export const sendNewBookingNotificationToTherapist = async (
  to,
  therapistName,
  clientName,
  clientEmail,
  date,
  startTime,
  endTime,
  amountPaid = 0
) => {
  await send(
    to,
    `New session booked with ${clientName}`,
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(therapistName)},</h2>
      <p>You have a new session booking from <strong>${escapeHtml(clientName)}</strong> (${escapeHtml(clientEmail)}).</p>
      ${sessionBlock(date, startTime, endTime)}
      ${amountPaid ? `<p style="color:#4F7161;"><strong>Paid online: ${escapeHtml(rupees(amountPaid))}</strong></p>` : ""}
      <p>Log in to your dashboard to see full details.</p>
    `
  );
};

export const sendCancellationToClient = async (
  to,
  clientName,
  therapistName,
  date,
  startTime,
  endTime,
  reason,
  refundAmount = 0
) => {
  await send(
    to,
    `Session with ${therapistName} cancelled`,
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(clientName)},</h2>
      <p>Your session with <strong>${escapeHtml(therapistName)}</strong> has been cancelled.</p>
      ${sessionBlock(date, startTime, endTime)}
      ${reason ? `<p><strong>Message from your therapist:</strong><br/>${escapeHtml(reason)}</p>` : ""}
      ${refundAmount ? `<p style="color:#4F7161;"><strong>A full refund of ${escapeHtml(rupees(refundAmount))} has been issued.</strong> It usually reaches your account within 5–7 working days.</p>` : ""}
      <p>You're welcome to book a new time from your therapist's booking page.</p>
    `
  );
};

export const sendRescheduleToClient = async (
  to,
  clientName,
  therapistName,
  oldSession,
  newSession,
  message
) => {
  await send(
    to,
    `Your session with ${therapistName} has been rescheduled`,
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(clientName)},</h2>
      <p>Your session with <strong>${escapeHtml(therapistName)}</strong> has moved to a new time.</p>
      ${sessionBlock(newSession.date, newSession.startTime, newSession.endTime, "New time")}
      <p style="color:#A89C8F; font-size:13px; text-decoration:line-through;">
        Previously: ${escapeHtml(formatDate(oldSession.date))}, ${escapeHtml(oldSession.startTime)} – ${escapeHtml(oldSession.endTime)}
      </p>
      ${message ? `<p><strong>Message from your therapist:</strong><br/>${escapeHtml(message)}</p>` : ""}
      <p>If this time doesn't work for you, please reach out to your therapist directly.</p>
    `
  );
};

// The client paid, but the slot was taken before the booking could be confirmed
export const sendSlotTakenRefundToClient = async (to, clientName, therapistName, date, startTime, amount) => {
  await send(
    to,
    `Your payment to ${therapistName} has been refunded`,
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(clientName)},</h2>
      <p>We're sorry — the time you chose with <strong>${escapeHtml(therapistName)}</strong>
      (${escapeHtml(formatDate(date))}, ${escapeHtml(startTime)}) was booked by someone else while your payment was processing.</p>
      <p style="color:#4F7161;"><strong>Your payment of ${escapeHtml(rupees(amount))} has been fully refunded.</strong>
      It usually reaches your account within 5–7 working days.</p>
      <p>Please choose another time on your therapist's booking page.</p>
    `
  );
};

// Sent when the therapist messages a client who isn't online. Never includes the message text.
export const sendNewMessageEmail = async (to, clientName, therapistName, portalUrl) => {
  await send(
    to,
    `New message from ${therapistName}`,
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(clientName)},</h2>
      <p>You have a new message from <strong>${escapeHtml(therapistName)}</strong>.
      For your privacy, messages are only shown in your client space.</p>
      ${button(portalUrl, "Read message")}
      <p style="color:#A89C8F; font-size:13px;">Keep this email private: the button is your personal link.</p>
    `
  );
};

// A fresh link into the client space, sent on the therapist's request
export const sendPortalLinkEmail = async (to, clientName, therapistName, portalUrl) => {
  await send(
    to,
    `Your client space with ${therapistName}`,
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(clientName)},</h2>
      <p><strong>${escapeHtml(therapistName)}</strong> sent you a link to your private client space,
      where you can join video sessions and send messages.</p>
      ${button(portalUrl, "Open your client space")}
      <p style="color:#A89C8F; font-size:13px;">Keep this email private: the button is your personal link. It works for 90 days.</p>
    `
  );
};

// 6-digit code to confirm the client's email (when booking, or to sign in)
export const sendVerificationCodeEmail = async (to, name, code, purpose, therapistName = "") => {
  const intro =
    purpose === "booking"
      ? `Enter this code to confirm your booking${therapistName ? ` with <strong>${escapeHtml(therapistName)}</strong>` : ""}.`
      : "Enter this code to open your client space.";
  await send(
    to,
    purpose === "booking" ? `${code} is your booking code` : `${code} is your sign-in code`,
    `
      <h2 style="margin:0 0 12px;">Hi${name ? ` ${escapeHtml(name)}` : ""},</h2>
      <p>${intro}</p>
      <p style="font-size:32px; font-weight:700; letter-spacing:8px; color:#D96B00; margin:20px 0;">${escapeHtml(code)}</p>
      <p>The code expires in 10 minutes.</p>
      <p style="color:#A89C8F; font-size:13px;">If you didn't request this, you can ignore this email — nothing will be booked.</p>
    `
  );
};
