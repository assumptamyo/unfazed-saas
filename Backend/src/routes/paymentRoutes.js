import express from "express";
import { body, param, query } from "express-validator";
import validateRequest from "../middleware/validateRequest.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  verifyPayment,
  getPaymentStatus,
  releaseHold,
  handleWebhook,
  getPublicReceipt,
} from "../controllers/paymentController.js";
import {
  getBillingSummary,
  updateSessionFee,
  getPayments,
  downloadReceipt,
  refundPaymentById,
} from "../controllers/billingController.js";

// ----- Public: used by the client's booking page and by Razorpay -----
export const paymentRouter = express.Router();

paymentRouter.post(
  "/verify",
  [
    body("razorpay_order_id").isString().notEmpty(),
    body("razorpay_payment_id").isString().notEmpty(),
    body("razorpay_signature").isString().notEmpty(),
  ],
  validateRequest,
  verifyPayment
);

paymentRouter.get("/status/:orderId", [param("orderId").isString().isLength({ max: 64 })], validateRequest, getPaymentStatus);

paymentRouter.post("/release", [body("orderId").isString().isLength({ min: 1, max: 64 })], validateRequest, releaseHold);

paymentRouter.post("/webhook", handleWebhook);

export const receiptRouter = express.Router();

receiptRouter.get("/:token", [param("token").isHexadecimal().isLength({ min: 48, max: 48 })], validateRequest, getPublicReceipt);

// ----- Therapist billing (login required) -----
export const billingRouter = express.Router();

billingRouter.use(authMiddleware);

billingRouter.get("/summary", getBillingSummary);

billingRouter.put(
  "/fee",
  [body("sessionFee").isFloat({ min: 0 }).withMessage("sessionFee must be a number")],
  validateRequest,
  updateSessionFee
);

billingRouter.get(
  "/payments",
  [query("status").optional().isIn(["paid", "refunded", "failed", "processing"]).withMessage("Invalid status")],
  validateRequest,
  getPayments
);

const idParam = param("id").isMongoId().withMessage("Invalid payment id");

billingRouter.get("/payments/:id/receipt", [idParam], validateRequest, downloadReceipt);

billingRouter.post(
  "/payments/:id/refund",
  [idParam, body("reason").optional().isString().isLength({ max: 500 })],
  validateRequest,
  refundPaymentById
);
