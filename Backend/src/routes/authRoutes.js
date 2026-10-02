import express from "express";
import { body } from "express-validator";

import {
  register,
  login,
  verifyEmail,
  resendOtp,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();

// @route  POST /api/auth/register
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("A valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  validateRequest,
  register
);

// @route  POST /api/auth/login
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("A valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validateRequest,
  login
);

// @route  POST /api/auth/verify-email
router.post(
  "/verify-email",
  [
    body("email").isEmail().withMessage("A valid email is required"),
    body("otp")
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be 6 digits"),
  ],
  validateRequest,
  verifyEmail
);

// @route  POST /api/auth/resend-otp
router.post(
  "/resend-otp",
  [
    body("email").isEmail().withMessage("A valid email is required"),
    body("purpose")
      .isIn(["email_verification", "password_reset"])
      .withMessage("Invalid OTP purpose"),
  ],
  validateRequest,
  resendOtp
);

// @route  POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("A valid email is required")],
  validateRequest,
  forgotPassword
);

// @route  POST /api/auth/reset-password
router.post(
  "/reset-password",
  [
    body("email").isEmail().withMessage("A valid email is required"),
    body("otp")
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be 6 digits"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  validateRequest,
  resetPassword
);

export default router;