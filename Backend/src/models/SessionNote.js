import mongoose from "mongoose";

export const NOTE_TEMPLATES = {
  soap: ["subjective", "objective", "assessment", "plan"],
  dap: ["data", "assessment", "plan"],
  free: ["body"],
};

export const NOTE_SECTION_KEYS = [...new Set(Object.values(NOTE_TEMPLATES).flat())];

const sectionsSchema = new mongoose.Schema(
  Object.fromEntries(NOTE_SECTION_KEYS.map((key) => [key, { type: String, default: "" }])),
  { _id: false }
);

// Private clinical note for one session. Only the therapist who owns it can read it;
// it is never sent to clients or shown on public pages.
const sessionNoteSchema = new mongoose.Schema(
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
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    template: {
      type: String,
      enum: Object.keys(NOTE_TEMPLATES),
      default: "soap",
    },
    sections: {
      type: sectionsSchema,
      default: () => ({}),
    },
    // Drafts can be edited freely; signed notes are locked and only accept addenda
    status: {
      type: String,
      enum: ["draft", "signed"],
      default: "draft",
    },
    signedAt: {
      type: Date,
    },
    addenda: [
      {
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// One note per session
sessionNoteSchema.index({ session: 1 }, { unique: true });
sessionNoteSchema.index({ therapist: 1, client: 1, updatedAt: -1 });

export default mongoose.model("SessionNote", sessionNoteSchema);
