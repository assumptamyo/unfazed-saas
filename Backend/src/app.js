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


const app = express();

app.use(cors());
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

app.use(errorHandler);

export default app;
