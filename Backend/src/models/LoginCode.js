import mongoose from "mongoose";

// A sign-in code emailed to a client who wants to open their client space
const loginCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    sends: { type: Number, default: 1 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Remove stale codes automatically
loginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 });

export default mongoose.model("LoginCode", loginCodeSchema);
