import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getMyProfile, getPublicProfile } from "../controllers/therapistController.js";

const router = express.Router();

router.get("/me", authMiddleware, getMyProfile);
router.get("/:slug", getPublicProfile);

export default router;