import express from "express";
import { body, param, query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  getNotes,
  getPendingNotes,
  getNoteForSession,
  saveDraft,
  signNote,
  addAddendum,
  deleteDraft,
} from "../controllers/notesController.js";

const router = express.Router();

// Notes are private clinical records: every route requires the owning therapist
router.use(authMiddleware);

router.get(
  "/",
  [
    query("status").optional().isIn(["draft", "signed"]).withMessage("Invalid status"),
    query("client").optional().isMongoId().withMessage("Invalid client id"),
    query("visibility").optional().isIn(["private", "shared"]).withMessage("Invalid visibility"),
  ],
  validateRequest,
  getNotes
);

router.get("/pending", getPendingNotes);

const sessionParam = param("sessionId").isMongoId().withMessage("Invalid session id");
const idParam = param("id").isMongoId().withMessage("Invalid note id");

const visibilityQuery = query("visibility").optional().isIn(["private", "shared"]).withMessage("Invalid visibility");

router.get("/session/:sessionId", [sessionParam, visibilityQuery], validateRequest, getNoteForSession);

router.put(
  "/session/:sessionId",
  [
    sessionParam,
    body("template").optional().isIn(["soap", "dap", "free"]).withMessage("Invalid template"),
    body("sections").optional().isObject().withMessage("sections must be an object"),
    body("visibility").optional().isIn(["private", "shared"]).withMessage("Invalid visibility"),
  ],
  validateRequest,
  saveDraft
);

router.post("/:id/sign", [idParam], validateRequest, signNote);

router.post(
  "/:id/addenda",
  [
    idParam,
    body("text").isString().trim().isLength({ min: 1, max: 5000 }).withMessage("Addendum text is required"),
  ],
  validateRequest,
  addAddendum
);

router.delete("/:id", [idParam], validateRequest, deleteDraft);

export default router;
