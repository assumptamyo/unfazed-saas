import mongoose from "mongoose";

// One record per notification attempt on one channel. Doubles as the queue/log for
// stubbed channels (WhatsApp) and as the therapist's in-app notification feed.
const notificationSchema = new mongoose.Schema(
  {
    event: { type: String, required: true }, // e.g. "booking.confirmed"
    channel: { type: String, enum: ["email", "whatsapp", "in_app"], required: true },
    audience: { type: String, enum: ["client", "therapist"], required: true },
    status: {
      type: String,
      enum: ["queued", "sent", "stubbed", "skipped", "failed"],
      required: true,
    },
    therapist: { type: mongoose.Schema.Types.ObjectId, ref: "Therapist", required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
    recipient: { type: String, default: "" }, // email address, phone number or "therapist"
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    link: { type: String, default: "" }, // where the in-app notification leads
    error: { type: String, default: "" },
    readAt: { type: Date }, // in-app only
    // Prevents the same notification being created twice (e.g. a reminder)
    dedupeKey: { type: String },
  },
  { timestamps: true }
);

notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
notificationSchema.index({ therapist: 1, channel: 1, createdAt: -1 });
notificationSchema.index({ therapist: 1, channel: 1, readAt: 1 });

export default mongoose.model("Notification", notificationSchema);
