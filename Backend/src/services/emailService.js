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

const send = (to, subject, body) =>
  getTransporter().sendMail({ from: fromAddress(), to, subject, html: layout(body) });

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

export const sendBookingConfirmationToClient = async (
  to,
  clientName,
  therapistName,
  date,
  startTime,
  endTime
) => {
  await send(
    to,
    `Session confirmed with ${therapistName}`,
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(clientName)},</h2>
      <p>Your session with <strong>${escapeHtml(therapistName)}</strong> has been confirmed.</p>
      ${sessionBlock(date, startTime, endTime)}
      <p>If you need to make any changes, please reach out to your therapist directly.</p>
    `
  );
};

export const sendNewBookingNotificationToTherapist = async (
  to,
  therapistName,
  clientName,
  clientEmail,
  date,
  startTime,
  endTime
) => {
  await send(
    to,
    `New session booked with ${clientName}`,
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(therapistName)},</h2>
      <p>You have a new session booking from <strong>${escapeHtml(clientName)}</strong> (${escapeHtml(clientEmail)}).</p>
      ${sessionBlock(date, startTime, endTime)}
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
  reason
) => {
  await send(
    to,
    `Session with ${therapistName} cancelled`,
    `
      <h2 style="margin:0 0 12px;">Hi ${escapeHtml(clientName)},</h2>
      <p>Your session with <strong>${escapeHtml(therapistName)}</strong> has been cancelled.</p>
      ${sessionBlock(date, startTime, endTime)}
      ${reason ? `<p><strong>Message from your therapist:</strong><br/>${escapeHtml(reason)}</p>` : ""}
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
