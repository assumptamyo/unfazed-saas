import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
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
    date: {
      type: Date, // the calendar date of the session, e.g. 2026-10-14
      required: true,
    },
    startTime: {
      type: String, // "10:00"
      required: true,
    },
    endTime: {
      type: String, // "10:50"
      required: true,
    },
    status: {
      type: String,
      enum: ["confirmed", "cancelled", "completed", "no-show"],
      default: "confirmed",
    },
    sessionType: {
      type: String,
      default: "individual", 
    },
    notes: {
      type: String,
      default: "", 
    },
  },
  { timestamps: true }
);

// Prevent the same therapist from being double-booked at the exact same date+time
sessionSchema.index({ therapist: 1, date: 1, startTime: 1 }, { unique: true });

export default mongoose.model("Session", sessionSchema);