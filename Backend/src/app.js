import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import errorHandler from "./middleware/errorhandler.js";
import therapistRoutes from "./routes/therapistRoutes.js";
import availabilityRoutes from "./routes/availabilityRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import notesRoutes from "./routes/notesRoutes.js";
import { paymentRouter, receiptRouter, billingRouter } from "./routes/paymentRoutes.js";
import { messageRouter, portalRouter } from "./routes/messageRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";


const app = express();

// Behind the host's HTTPS proxy, so req.protocol reports "https" (used for uploaded photo links)
app.set("trust proxy", 1);

// Only the frontend may call the API from a browser (FRONTEND_URL, comma-separated for several).
// Without FRONTEND_URL (local development) any origin is allowed.
const allowedOrigins = (process.env.FRONTEND_URL || "").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
// Keep the raw body too: Razorpay webhook signatures are computed over the exact bytes
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});
app.use("/api/therapist", therapistRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/availability", availabilityRoutes);

app.use("/uploads", express.static("uploads"));

app.use("/api/clients", clientRoutes);

app.use("/api/appointments", appointmentRoutes);

app.use("/api/notes", notesRoutes);

app.use("/api/payments", paymentRouter);
app.use("/api/receipts", receiptRouter);
app.use("/api/billing", billingRouter);

app.use("/api/messages", messageRouter);
app.use("/api/portal", portalRouter);

app.use("/api/subscription", subscriptionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(errorHandler);

export default app;
