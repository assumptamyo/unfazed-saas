import mongoose from "mongoose";

export const NOTE_TEMPLATES = {
  soap: ["subjective", "objective", "assessment", "plan"],
  dap: ["data", "assessment", "plan"],
  free: ["body"],
};

// private: the therapist's clinical record, never sent to a client
// shared:  written for the client; visible in their client space once signed
export const NOTE_VISIBILITY = ["private", "shared"];

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
    visibility: {
      type: String,
      enum: NOTE_VISIBILITY,
      default: "private",
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
    // When a shared note became visible to the client (it's shared when signed)
    sharedAt: {
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

// Each session can have one private note and one shared note
sessionNoteSchema.index({ session: 1, visibility: 1 }, { unique: true, name: "one_note_per_visibility" });
// Fast lookup for the client portal, which only ever reads shared notes
sessionNoteSchema.index({ client: 1, visibility: 1, status: 1 });
sessionNoteSchema.index({ therapist: 1, client: 1, updatedAt: -1 });

export default mongoose.model("SessionNote", sessionNoteSchema);
