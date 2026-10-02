import express from "express";
import { body, param, query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  getAppointments,
  getAppointmentById,
  getRescheduleSlots,
  updateAppointmentStatus,
  cancelAppointment,
  rescheduleAppointment,
  joinVideoAsTherapist,
} from "../controllers/appointmentController.js";

const router = express.Router();

router.use(authMiddleware);

const idParam = param("id").isMongoId().withMessage("Invalid appointment id");

router.get(
  "/",
  [
    query("view")
      .optional()
      .isIn(["upcoming", "attention", "past", "cancelled", "all"])
      .withMessage("Invalid view"),
  ],
  validateRequest,
  getAppointments
);

router.get(
  "/available-slots",
  [
    query("days").optional().isInt({ min: 1, max: 60 }).withMessage("days must be 1-60"),
    query("exclude").optional().isMongoId().withMessage("Invalid appointment id"),
  ],
  validateRequest,
  getRescheduleSlots
);

router.get("/:id", [idParam], validateRequest, getAppointmentById);

router.patch(
  "/:id/status",
  [
    idParam,
    body("status")
      .isIn(["confirmed", "completed", "no-show"])
      .withMessage("status must be confirmed, completed, or no-show"),
  ],
  validateRequest,
  updateAppointmentStatus
);

router.post(
  "/:id/cancel",
  [
    idParam,
    body("reason").optional().isString().isLength({ max: 1000 }),
    body("notifyClient").optional().isBoolean().toBoolean(),
    body("refund").optional().isBoolean().toBoolean(),
  ],
  validateRequest,
  cancelAppointment
);

router.post(
  "/:id/reschedule",
  [
    idParam,
    body("date").isISO8601().withMessage("Valid date is required"),
    body("startTime")
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage("Invalid startTime (HH:mm)"),
    body("message").optional().isString().isLength({ max: 1000 }),
    body("notifyClient").optional().isBoolean().toBoolean(),
  ],
  validateRequest,
  rescheduleAppointment
);

router.post("/:id/video", [idParam], validateRequest, joinVideoAsTherapist);

export default router;
