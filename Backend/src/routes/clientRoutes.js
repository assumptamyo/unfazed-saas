import express from "express";
import { param, body } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  getClients,
  getClientById,
  updateClient,
  archiveClient,
  restoreClient,
  deleteClient,
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

export default router;