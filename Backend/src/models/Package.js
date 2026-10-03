import mongoose from "mongoose";

export const PACKAGE_SIZES = [3, 6, 12];

// A session bundle a therapist offers on their booking page, e.g. "6 sessions at
// ₹600 each, valid for 90 days". One per size per therapist.
const packageSchema = new mongoose.Schema(
  {
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Therapist",
      required: true,
    },
    sessionCount: {
      type: Number,
      enum: PACKAGE_SIZES,
      required: true,
    },
    pricePerSession: {
      type: Number, // paise
      required: true,
      min: 100,
    },
    validityDays: {
      type: Number,
      required: true,
      min: 7,
      max: 730,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

packageSchema.index({ therapist: 1, sessionCount: 1 }, { unique: true });

packageSchema.virtual("totalPrice").get(function totalPrice() {
  return this.sessionCount * this.pricePerSession;
});

export default mongoose.model("Package", packageSchema);
