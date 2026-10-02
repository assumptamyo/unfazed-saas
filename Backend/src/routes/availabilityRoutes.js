import express from "express";
import { body, param, query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  setAvailability,
  getMyAvailability,
  deleteAvailability,
  createOverride,
  getMyOverrides,
  getOverrideImpact,
  deleteOverride,
  removeOverrides,
  getAvailabilityCalendar,
} from "../controllers/availabilityController.js";

const router = express.Router();

// All routes here require the therapist to be logged in
router.use(authMiddleware);

router.post(
  "/",
  [
    body("dayOfWeek").isInt({ min: 0, max: 6 }).withMessage("dayOfWeek must be 0-6"),
    body("startTime").matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage("Invalid startTime format (HH:mm)"),
    body("endTime").matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage("Invalid endTime format (HH:mm)"),
    body("sessionDuration").isIn([30, 45, 60, 90]).withMessage("sessionDuration must be 30, 45, 60, or 90"),
  ],
  validateRequest,
  setAvailability
);

router.get("/", getMyAvailability);

router.get(
  "/calendar",
  [
    query("from").isISO8601().withMessage("Valid from date is required"),
    query("to").isISO8601().withMessage("Valid to date is required"),
  ],
  validateRequest,
  getAvailabilityCalendar
);

router.delete(
  "/:dayOfWeek",
  [param("dayOfWeek").isInt({ min: 0, max: 6 })],
  validateRequest,
  deleteAvailability
);

router.post(
  "/override",
  [
    body("date").isISO8601().withMessage("Valid date is required"),
    body("endDate").optional({ values: "falsy" }).isISO8601().withMessage("Valid end date is required"),
    body("type").isIn(["blocked", "custom"]).withMessage("type must be 'blocked' or 'custom'"),
    body("reason").optional().isString().isLength({ max: 200 }),
    body("cancelAffected").optional().isBoolean().toBoolean(),
    body("notifyClients").optional().isBoolean().toBoolean(),
  ],
  validateRequest,
  createOverride
);

router.get("/override", getMyOverrides);

router.get("/override/impact", getOverrideImpact);

router.post(
  "/override/remove",
  [
    body("ids").isArray({ min: 1, max: 100 }).withMessage("ids must be a non-empty list"),
    body("ids.*").isMongoId().withMessage("Invalid override id"),
  ],
  validateRequest,
  removeOverrides
);

router.delete(
  "/override/:id",
  [param("id").isMongoId().withMessage("Invalid override id")],
  validateRequest,
  deleteOverride
);

export default router;
