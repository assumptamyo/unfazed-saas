import express from "express";
import { body, param, query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import clientAuth from "../middleware/clientAuth.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  getConversations,
  getUnreadCount,
  getConversation,
  sendTherapistMessage,
  markConversationRead,
} from "../controllers/messageController.js";
import {
  startPortalSession,
  getPortal,
  joinVideoAsClient,
  getClientMessages,
  sendClientMessage,
  markClientRead,
  requestLoginCode,
  verifyLoginCode,
} from "../controllers/portalController.js";

const textRule = body("text").isString().trim().isLength({ min: 1, max: 4000 }).withMessage("Message must be 1-4000 characters");
const sessionRule = body("sessionId").optional({ values: "falsy" }).isMongoId();
const beforeRule = query("before").optional().isISO8601();

// ----- Therapist messaging -----
export const messageRouter = express.Router();
messageRouter.use(authMiddleware);

const clientParam = param("clientId").isMongoId().withMessage("Invalid client id");

messageRouter.get("/conversations", getConversations);
messageRouter.get("/unread-count", getUnreadCount);
messageRouter.get("/:clientId", [clientParam, beforeRule], validateRequest, getConversation);
messageRouter.post("/:clientId", [clientParam, textRule, sessionRule], validateRequest, sendTherapistMessage);
messageRouter.post("/:clientId/read", [clientParam], validateRequest, markConversationRead);

// ----- Client space (private link) -----
export const portalRouter = express.Router();

portalRouter.post("/session", [body("token").isString().isLength({ min: 64, max: 64 })], validateRequest, startPortalSession);

portalRouter.post(
  "/login/request",
  [body("email").isEmail().withMessage("Enter a valid email address")],
  validateRequest,
  requestLoginCode
);
portalRouter.post(
  "/login/verify",
  [body("email").isEmail(), body("code").isString().matches(/^\d{6}$/).withMessage("Enter the 6-digit code")],
  validateRequest,
  verifyLoginCode
);

portalRouter.use(clientAuth);
portalRouter.get("/me", getPortal);
portalRouter.post("/sessions/:id/video", [param("id").isMongoId()], validateRequest, joinVideoAsClient);
portalRouter.get("/messages", [beforeRule], validateRequest, getClientMessages);
portalRouter.post("/messages", [textRule, sessionRule], validateRequest, sendClientMessage);
portalRouter.post("/messages/read", markClientRead);
