import SessionNote from "../models/SessionNote.js";
import { sanitizeRichText } from "../utils/richText.js";
import { toDateKey } from "../utils/dateUtils.js";

// The ONLY way notes reach a client. Two independent guards keep private notes out:
//   1. the query asks the database for shared + signed notes only
//   2. the serializer refuses anything that isn't shared + signed, so a future
//      change to the query can't leak a private note by accident

export const clientVisible = (note) => note?.visibility === "shared" && note?.status === "signed";

// Whitelists the fields a client may see; private fields (template sections,
// addenda, drafts) are never copied over
export const toClientNote = (note) => {
  if (!clientVisible(note)) {
    throw new Error("Refusing to send a non-shared note to a client");
  }
  return {
    id: note._id,
    sharedAt: note.sharedAt || note.signedAt,
    session: note.session?.date
      ? { date: toDateKey(note.session.date), startTime: note.session.startTime }
      : null,
    // Sanitized again on the way out, in case old data predates sanitizing on save
    html: sanitizeRichText(note.sections?.body || ""),
  };
};

export const getSharedNotesForClient = async (client) => {
  const notes = await SessionNote.find({
    client: client._id,
    therapist: client.therapist,
    visibility: "shared",
    status: "signed",
  })
    .populate("session", "date startTime")
    .sort({ sharedAt: -1, signedAt: -1 });

  return notes.filter(clientVisible).map(toClientNote);
};
