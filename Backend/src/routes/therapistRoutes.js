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
import { bookSession } from "../controllers/bookingController.js";
import { getDashboardStats } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, updateMyProfile);
router.post("/upload-photo", authMiddleware, upload.single("photo"), uploadPhoto);
router.get("/dashboard-stats", authMiddleware, getDashboardStats);

router.get("/:slug/slots", getTherapistSlots);

router.get("/:slug", getPublicProfile);

router.post(
  "/:slug/book",
  [
    body("clientName").trim().notEmpty().withMessage("Name is required"),
    body("clientEmail").isEmail().withMessage("A valid email is required"),
    body("date").isISO8601().withMessage("Valid date is required"),
    body("startTime").matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage("Invalid startTime"),
    body("consentAgreed").isBoolean({ strict: true }).withMessage("Consent confirmation is required"),
  ],
  validateRequest,
  bookSession
);

export default router;