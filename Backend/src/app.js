import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import errorHandler from "./middleware/errorhandler.js";
import therapistRoutes from "./routes/therapistRoutes.js";


const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});
app.use("/api/therapist", therapistRoutes);

// Routes
app.use("/api/auth", authRoutes);

app.use(errorHandler);

export default app;