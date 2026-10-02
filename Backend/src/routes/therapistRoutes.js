import express from "express";
import { body } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import upload from "../middleware/upload.js";
import {
  getMyProfile,
  getPublicProfile,
  getTherapistSlots,
  updateMyProfile,
  uploadPhoto,
} from "../controllers/therapistController.js";
import {
  startBooking,
  verifyBooking,
  resendBookingCode,
  cancelBookingRequest,
} from "../controllers/bookingController.js";
import { getDashboardStats } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, updateMyProfile);
router.post("/upload-photo", authMiddleware, upload.single("photo"), uploadPhoto);
router.get("/dashboard-stats", authMiddleware, getDashboardStats);

router.get("/:slug/slots", getTherapistSlots);

router.get("/:slug", getPublicProfile);

router.post(
  "/:slug/book/start",
  [
    body("clientName").trim().notEmpty().withMessage("Name is required"),
    body("clientEmail").isEmail().withMessage("A valid email is required"),
    body("date").isISO8601().withMessage("Valid date is required"),
    body("startTime").matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage("Invalid startTime"),
    body("consentAgreed").isBoolean({ strict: true }).withMessage("Consent confirmation is required"),
    body("clientToken").optional().isString().isLength({ max: 1000 }),
  ],
  validateRequest,
  startBooking
);

router.post(
  "/:slug/book/verify",
  [
    body("requestId").isMongoId().withMessage("Invalid booking request"),
    body("code").isString().matches(/^\d{6}$/).withMessage("Enter the 6-digit code"),
  ],
  validateRequest,
  verifyBooking
);

router.post(
  "/:slug/book/resend",
  [body("requestId").isMongoId().withMessage("Invalid booking request")],
  validateRequest,
  resendBookingCode
);

router.post(
  "/:slug/book/cancel",
  [body("requestId").isMongoId().withMessage("Invalid booking request")],
  validateRequest,
  cancelBookingRequest
);

export default router;