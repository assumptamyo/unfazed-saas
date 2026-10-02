import mongoose from "mongoose";

// A secure message between a therapist and one of their clients.
// `session` is set when the message was sent from inside a video session.
const messageSchema = new mongoose.Schema(
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
    sender: {
      type: String,
      enum: ["therapist", "client"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    readAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

messageSchema.index({ therapist: 1, client: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
