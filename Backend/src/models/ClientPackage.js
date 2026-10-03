import mongoose from "mongoose";

// A package a client has bought. Each booking made with it uses one session credit
// (sessionsUsed goes up); a session cancelled by the therapist gives the credit back.
const clientPackageSchema = new mongoose.Schema(
  {
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Therapist",
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    // Copied at purchase time so later price changes don't affect what was bought
    sessionsTotal: { type: Number, required: true, min: 1 },
    sessionsUsed: { type: Number, default: 0, min: 0 },
    pricePerSession: { type: Number, required: true }, // paise
    amountPaid: { type: Number, required: true }, // paise
    purchasedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    // "active" while usable; "refunded" once the unused part was paid back.
    // Exhausted / expired are worked out from sessionsUsed and expiresAt.
    status: {
      type: String,
      enum: ["active", "refunded"],
      default: "active",
    },
    refundedAt: { type: Date },
  },
  { timestamps: true }
);

clientPackageSchema.index({ therapist: 1, client: 1, status: 1, expiresAt: 1 });

export default mongoose.model("ClientPackage", clientPackageSchema);
