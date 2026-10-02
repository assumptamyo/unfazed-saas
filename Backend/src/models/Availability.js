import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema(
  {
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Therapist",
      required: true,
    },
    dayOfWeek: {
      type: Number, // 0 = Sunday, 1 = Monday, ... 6 = Saturday
      required: true,
      min: 0,
      max: 6,
    },
    startTime: {
      type: String, // "09:00" - stored as 24hr string for simplicity
      required: true,
    },
    endTime: {
      type: String, // "17:00"
      required: true,
    },
    sessionDuration: {
      type: Number, // minutes: 30, 45, 60, or 90
      required: true,
      enum: [30, 45, 60, 90],
    },
    bufferMinutes: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Availability", availabilitySchema);