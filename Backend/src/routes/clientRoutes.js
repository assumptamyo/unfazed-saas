import express from "express";
import { param, body } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import { normalizeIndianMobile } from "../utils/phone.js";
import {
  getClients,
  getClientById,
  updateClient,
  archiveClient,
  restoreClient,
  deleteClient,
  sendPortalLink,
} from "../controllers/clientController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getClients);

router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid client id")],
  validateRequest,
  getClientById
);

router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid client id"),
    body("status").optional().isIn(["active", "inactive"]),
    body("phone")
      .optional()
      .custom((v) => v === "" || Boolean(normalizeIndianMobile(v)))
      .withMessage("Enter a valid 10-digit Indian mobile number"),
    body("whatsappOptIn").optional().isBoolean({ strict: true }),
  ],
  validateRequest,
  updateClient
);

const idParam = param("id").isMongoId().withMessage("Invalid client id");

router.post(
  "/:id/archive",
  [idParam, body("notifyClient").optional().isBoolean().toBoolean()],
  validateRequest,
  archiveClient
);

router.post("/:id/restore", [idParam], validateRequest, restoreClient);

router.delete("/:id", [idParam], validateRequest, deleteClient);

router.post("/:id/portal-link", [idParam], validateRequest, sendPortalLink);

export default router;