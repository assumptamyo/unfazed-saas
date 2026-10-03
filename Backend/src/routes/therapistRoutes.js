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
import { normalizeIndianMobile } from "../utils/phone.js";

const router = express.Router();

router.get("/me", authMiddleware, getMyProfile);
const listRule = (field, maxItems, maxLength) => [
  body(field).optional().isArray({ max: maxItems }).withMessage(`Add at most ${maxItems} ${field}`),
  body(`${field}.*`).isString().trim().isLength({ min: 1, max: maxLength }).withMessage(`Each entry must be 1-${maxLength} characters`),
];

router.put(
  "/me",
  authMiddleware,
  [
    body("name").optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage("Name must be 2-80 characters"),
    body("bio").optional().isString().isLength({ max: 1500 }).withMessage("Bio can be at most 1500 characters"),
    body("qualifications").optional().isString().isLength({ max: 300 }).withMessage("Qualifications can be at most 300 characters"),
    body("yearsOfExperience").optional().isInt({ min: 0, max: 70 }).withMessage("Years of experience must be 0-70").toInt(),
    body("photoUrl").optional().isString().isLength({ max: 500 }),
    ...listRule("specializations", 15, 50),
    ...listRule("languages", 12, 30),
  ],
  validateRequest,
  updateMyProfile
);

// Turn upload problems (wrong type, too big) into a clear 400 instead of a server error
const photoUpload = (req, res, next) =>
  upload.single("photo")(req, res, (err) => {
    if (!err) return next();
    const message = err.code === "LIMIT_FILE_SIZE" ? "Photo must be 5MB or smaller" : err.message;
    return res.status(400).json({ message });
  });

router.post("/upload-photo", authMiddleware, photoUpload, uploadPhoto);
router.get("/dashboard-stats", authMiddleware, getDashboardStats);

router.get("/:slug/slots", getTherapistSlots);

router.get("/:slug", getPublicProfile);

router.post(
  "/:slug/book/start",
  [
    body("clientName").trim().notEmpty().withMessage("Name is required"),
    body("clientEmail").isEmail().withMessage("A valid email is required"),
    body("clientPhone")
      .custom((v) => Boolean(normalizeIndianMobile(v)))
      .withMessage("Enter a valid 10-digit Indian mobile number"),
    body("whatsappOptIn").optional().isBoolean({ strict: true }),
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