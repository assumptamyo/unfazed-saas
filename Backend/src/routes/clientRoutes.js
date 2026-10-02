import express from "express";
import { param, body } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import { getClients, getClientById, updateClient } from "../controllers/clientController.js";

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

export default router;