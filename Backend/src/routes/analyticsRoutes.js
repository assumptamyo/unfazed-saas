import express from "express";
import { query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import requireFeature from "../middleware/entitlementMiddleware.js";
import { getOverview, getAdvanced } from "../controllers/analyticsController.js";

const router = express.Router();
router.use(authMiddleware);

// Basic numbers on every plan
router.get("/overview", getOverview);

// Trends are a plan feature: the entitlement service decides, not this route
router.get(
  "/advanced",
  requireFeature("analytics.advanced"),
  [query("months").optional().isInt({ min: 3, max: 12 })],
  validateRequest,
  getAdvanced
);

export default router;
