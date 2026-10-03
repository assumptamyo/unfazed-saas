import mongoose from "mongoose";

// A booking waiting for the client to confirm their email with a code.
// While pending (and not expired) it holds the slot so nobody else can take it.
const bookingRequestSchema = new mongoose.Schema(
  {
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Therapist",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "expired"],
      default: "pending",
    },
    booking: {
      clientName: { type: String, required: true },
      clientEmail: { type: String, required: true },
      clientPhone: { type: String, default: "" },
      whatsappOptIn: { type: Boolean, default: true },
      date: { type: Date, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      notes: { type: String, default: "" },
      age: { type: Number },
      gender: { type: String, default: "" },
      occupation: { type: String, default: "" },
      presentingConcern: { type: String, default: "" },
    },
    // Package the client chose to buy with this booking (if any)
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
    },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    sends: { type: Number, default: 1 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

bookingRequestSchema.index({ therapist: 1, status: 1, expiresAt: 1 });
// Clean up old requests automatically a day after they expire
bookingRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export default mongoose.model("BookingRequest", bookingRequestSchema);
