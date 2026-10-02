import mongoose from "mongoose";

export const SESSION_STATUSES = ["confirmed", "cancelled", "completed", "no-show"];

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
      type: Date, // the calendar date of the session, stored as UTC midnight, e.g. 2026-10-14
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
      enum: SESSION_STATUSES,
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
    statusUpdatedAt: {
      type: Date,
    },
    cancellation: {
      cancelledAt: { type: Date },
      cancelledBy: { type: String, enum: ["therapist", "client"] },
      reason: { type: String, default: "" },
    },
    // Previous times this session was moved from, oldest first
    rescheduleHistory: [
      {
        _id: false,
        date: { type: Date },
        startTime: { type: String },
        endTime: { type: String },
        rescheduledAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Prevent double-booking the same start time. Cancelled sessions are excluded
// so a cancelled slot can be booked again.
sessionSchema.index(
  { therapist: 1, date: 1, startTime: 1 },
  {
    unique: true,
    name: "unique_active_slot",
    partialFilterExpression: { status: { $eq: "confirmed" } },
  }
);

export default mongoose.model("Session", sessionSchema);
