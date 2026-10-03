import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Therapist",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please fill a valid email address",
      ],
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    // The client can turn off WhatsApp reminders when booking (or the therapist can, on request)
    whatsappOptIn: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    tags: {
      type: [String],
      default: [],
    },
    intake: {
      demographics: {
        age: { type: Number },
        gender: { type: String, default: "" },
        occupation: { type: String, default: "" },
      },
      presentingConcern: {
        type: String,
        default: "",
      },
      history: {
        type: String,
        default: "",
      },
    },
    // Private links into the client space. Only SHA-256 hashes are stored;
    // the raw token exists only in the link emailed to the client.
    portalTokens: [
      {
        _id: false,
        hash: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
      },
    ],
    // Throttles "you have a new message" emails
    lastMessageEmailAt: {
      type: Date,
    },
    // Set when the therapist archives the client; archived clients are hidden
    // from lists but their history is kept
    archivedAt: {
      type: Date,
      default: null,
    },
    consent: {
      agreed: {
        type: Boolean,
        default: false,
      },
      agreedAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
    // Never send portal link hashes out of the API
    toJSON: { transform: (doc, ret) => (delete ret.portalTokens, ret) },
    toObject: { transform: (doc, ret) => (delete ret.portalTokens, ret) },
  }
);

// A therapist shouldn't have two clients with the same email
clientSchema.index({ therapist: 1, email: 1 }, { unique: true });

export default mongoose.model("Client", clientSchema);