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
  { timestamps: true }
);

// A therapist shouldn't have two clients with the same email
clientSchema.index({ therapist: 1, email: 1 }, { unique: true });

export default mongoose.model("Client", clientSchema);