import express from "express";
import { body } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import { getMyEntitlements, getPlans, changePlan } from "../controllers/subscriptionController.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", getPlans);
router.get("/entitlements", getMyEntitlements);
router.post(
  "/change",
  [body("tierKey").isString().trim().notEmpty().withMessage("Choose a plan")],
  validateRequest,
  changePlan
);

export default router;
