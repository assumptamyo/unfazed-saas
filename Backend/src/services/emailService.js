import nodemailer from "nodemailer";

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

export const verifyEmailService = async () => {
  try {
    await getTransporter().verify();
    console.log("Email service ready");
  } catch (error) {
    console.error("Email service connection failed:", error.message);
  }
};

export const sendWelcomeEmail = async (to, name) => {
  const mailOptions = {
    from: `"Unfazed" <${process.env.EMAIL_FROM}>`,
    to,
    subject: "Welcome to Unfazed",
    html: `
      <h2>Welcome, ${name}!</h2>
      <p>Your Unfazed account has been created successfully.</p>
      <p>You can now set up your profile and start managing your practice.</p>
    `,
  };

  await getTransporter().sendMail(mailOptions);
  console.log(`Welcome email sent to ${to}`);
  console.log(`Welcome email sent from ${process.env.EMAIL_FROM}`);
};

export const sendOtpEmail = async (to, name, otp, purpose) => {
  const subject =
    purpose === "password_reset"
      ? "Reset Your Password - OTP"
      : "Verify Your Email - OTP";

  const message =
    purpose === "password_reset"
      ? "Use the OTP below to reset your password."
      : "Use the OTP below to verify your email address.";

  const mailOptions = {
    from: `"Unfazed" <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    html: `
      <h2>Hi ${name},</h2>
      <p>${message}</p>
      <h1 style="letter-spacing: 4px;">${otp}</h1>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  };

  await getTransporter().sendMail(mailOptions);
};

export const sendBookingConfirmationToClient = async (
  to,
  clientName,
  therapistName,
  date,
  startTime,
  endTime,
) => {
  const mailOptions = {
    from: `"Unfazed" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Session confirmed with ${therapistName}`,
    html: `
      <h2>Hi ${clientName},</h2>
      <p>Your session with <strong>${therapistName}</strong> has been confirmed.</p>
      <p><strong>Date:</strong> ${date}<br/>
      <strong>Time:</strong> ${startTime} – ${endTime}</p>
      <p>If you need to make any changes, please reach out to your therapist directly.</p>
    `,
  };

  await getTransporter().sendMail(mailOptions);
};

export const sendNewBookingNotificationToTherapist = async (
  to,
  therapistName,
  clientName,
  clientEmail,
  date,
  startTime,
  endTime,
) => {
  const mailOptions = {
    from: `"Unfazed" <${process.env.EMAIL_USER}>`,
    to,
    subject: `New session booked with ${clientName}`,
    html: `
      <h2>Hi ${therapistName},</h2>
      <p>You have a new session booking.</p>
      <p><strong>Client:</strong> ${clientName} (${clientEmail})<br/>
      <strong>Date:</strong> ${date}<br/>
      <strong>Time:</strong> ${startTime} – ${endTime}</p>
      <p>Log in to your dashboard to see full details.</p>
    `,
  };

  await getTransporter().sendMail(mailOptions);
};
