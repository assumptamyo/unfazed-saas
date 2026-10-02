import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Therapist from "../models/Therapist.js";
import generateUniqueSlug from "../utils/generateSlug.js";
import generateOtp from "../utils/generateOtp.js";
import { sendWelcomeEmail, sendOtpEmail } from "../services/emailService.js";

const OTP_EXPIRY_MINUTES = 10;

// @desc   Register a new therapist
// @route  POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingTherapist = await Therapist.findOne({
      email: email.toLowerCase(),
    });
    if (existingTherapist) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const slug = await generateUniqueSlug(name);

    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const therapist = await Therapist.create({
      email,
      password_hash,
      name,
      slug,
      otp,
      otpExpiresAt,
      otpPurpose: "email_verification",
    });

    // Fire emails - don't block the response if these fail
    try {
      await sendWelcomeEmail(therapist.email, therapist.name);
      await sendOtpEmail(
        therapist.email,
        therapist.name,
        otp,
        "email_verification",
      );
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
      // Registration still succeeds even if email fails - user can request resend
    }

    return res.status(201).json({
      message:
        "Registration successful. Please check your email for the verification OTP.",
      therapist: {
        id: therapist._id,
        name: therapist.name,
        email: therapist.email,
        slug: therapist.slug,
        isVerified: therapist.isVerified,
      },
    });
  } catch (error) {
    console.error("Register error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error during registration" });
  }
};

// @desc   Verify email using OTP
// @route  POST /api/auth/verify-email
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const therapist = await Therapist.findOne({ email: email.toLowerCase() });
    if (!therapist) {
      return res.status(404).json({ message: "Therapist not found" });
    }

    if (therapist.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    if (therapist.otpPurpose !== "email_verification") {
      return res.status(400).json({ message: "Invalid OTP request" });
    }

    if (!therapist.otp || therapist.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (therapist.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    therapist.isVerified = true;
    therapist.otp = undefined;
    therapist.otpExpiresAt = undefined;
    therapist.otpPurpose = undefined;
    await therapist.save();

    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Verify email error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error during email verification" });
  }
};

// @desc   Resend OTP (for verification or password reset)
// @route  POST /api/auth/resend-otp
export const resendOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!["email_verification", "password_reset"].includes(purpose)) {
      return res.status(400).json({ message: "Invalid OTP purpose" });
    }

    const therapist = await Therapist.findOne({ email: email.toLowerCase() });
    if (!therapist) {
      return res.status(404).json({ message: "Therapist not found" });
    }

    if (purpose === "email_verification" && therapist.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const otp = generateOtp();
    therapist.otp = otp;
    therapist.otpExpiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    );
    therapist.otpPurpose = purpose;
    await therapist.save();

    await sendOtpEmail(therapist.email, therapist.name, otp, purpose);

    return res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Resend OTP error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while resending OTP" });
  }
};

// @desc   Login a therapist
// @route  POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const therapist = await Therapist.findOne({ email: email.toLowerCase() });
    if (!therapist) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, therapist.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { therapistId: therapist._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      therapist: {
        id: therapist._id,
        name: therapist.name,
        email: therapist.email,
        slug: therapist.slug,
        isVerified: therapist.isVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Server error during login" });
  }
};

// @desc   Request password reset OTP
// @route  POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const therapist = await Therapist.findOne({ email: email.toLowerCase() });
    if (!therapist) {
      // Generic response - don't reveal whether email exists
      return res.status(200).json({
        message:
          "If this email is registered, a password reset OTP has been sent.",
      });
    }

    const otp = generateOtp();
    therapist.otp = otp;
    therapist.otpExpiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    );
    therapist.otpPurpose = "password_reset";
    await therapist.save();

    await sendOtpEmail(therapist.email, therapist.name, otp, "password_reset");

    return res.status(200).json({
      message:
        "If this email is registered, a password reset OTP has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error during password reset request" });
  }
};

// @desc   Reset password using OTP
// @route  POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const therapist = await Therapist.findOne({ email: email.toLowerCase() });
    if (!therapist) {
      return res.status(404).json({ message: "Therapist not found" });
    }

    if (therapist.otpPurpose !== "password_reset") {
      return res.status(400).json({ message: "Invalid OTP request" });
    }

    if (!therapist.otp || therapist.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (therapist.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    const salt = await bcrypt.genSalt(10);
    therapist.password_hash = await bcrypt.hash(newPassword, salt);
    therapist.otp = undefined;
    therapist.otpExpiresAt = undefined;
    therapist.otpPurpose = undefined;
    await therapist.save();

    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error during password reset" });
  }
};
