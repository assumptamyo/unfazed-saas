import SessionNote, { NOTE_TEMPLATES, NOTE_SECTION_KEYS } from "../models/SessionNote.js";
import Client from "../models/Client.js";
import { sanitizeRichText, richTextToPlain } from "../utils/richText.js";
import { createPortalLink } from "../services/portalService.js";
import { sendSharedNoteEmail } from "../services/emailService.js";
import Session from "../models/Session.js";
import { toDateKey, addDaysToKey, todayKey, dateFromKey } from "../utils/dateUtils.js";
import { canAccess, upgradeRequired } from "../services/entitlementService.js";

const MAX_SECTION_LENGTH = 20000;

// "body" holds rich text (HTML); the other sections are plain text
const RICH_SECTIONS = new Set(["body"]);

const visibilityOf = (value) => (value === "shared" ? "shared" : "private");

const sectionText = (note) =>
  (NOTE_TEMPLATES[note.template] || NOTE_SECTION_KEYS)
    .map((key) => (RICH_SECTIONS.has(key) ? richTextToPlain(note.sections?.[key]) : note.sections?.[key] || ""))
    .filter(Boolean);

const serializeNote = (note) => {
  const texts = sectionText(note);
  const joined = texts.join(" ").replace(/\s+/g, " ").trim();
  return {
    id: note._id,
    sessionId: note.session?._id || note.session,
    client: note.client?._id
      ? { id: note.client._id, name: note.client.name, email: note.client.email }
      : null,
    session: note.session?._id
      ? {
          date: toDateKey(note.session.date),
          startTime: note.session.startTime,
          endTime: note.session.endTime,
          status: note.session.status,
        }
      : null,
    visibility: note.visibility || "private",
    sharedAt: note.sharedAt || null,
    template: note.template,
    sections: Object.fromEntries(NOTE_SECTION_KEYS.map((k) => [k, note.sections?.[k] || ""])),
    status: note.status,
    signedAt: note.signedAt || null,
    addenda: (note.addenda || []).map((a) => ({ id: a._id, text: a.text, createdAt: a.createdAt })),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    excerpt: joined.slice(0, 180),
    wordCount: joined ? joined.split(" ").length : 0,
  };
};

const populateNote = (query) =>
  query.populate("client", "name email").populate("session", "date startTime endTime status");

// @desc   All notes for the therapist, newest first, with optional filters
// @route  GET /api/notes?status=draft|signed&client=<id>&search=
export const getNotes = async (req, res) => {
  try {
    const { status, client, search, visibility } = req.query;
    const query = { therapist: req.therapist._id };
    if (client) query.client = client;
    if (visibility) query.visibility = visibilityOf(visibility);

    const notes = await populateNote(SessionNote.find(query).sort({ updatedAt: -1 }));
    let items = notes.map(serializeNote);

    const counts = {
      all: items.length,
      draft: items.filter((n) => n.status === "draft").length,
      signed: items.filter((n) => n.status === "signed").length,
    };

    if (status === "draft" || status === "signed") items = items.filter((n) => n.status === status);

    const q = (search || "").trim().toLowerCase();
    if (q) {
      items = items.filter(
        (n) =>
          n.client?.name.toLowerCase().includes(q) ||
          Object.entries(n.sections).some(([k, t]) => (RICH_SECTIONS.has(k) ? richTextToPlain(t) : t).toLowerCase().includes(q))
      );
    }

    return res.status(200).json({ notes: items, counts });
  } catch (error) {
    console.error("Get notes error:", error.message);
    return res.status(500).json({ message: "Server error while fetching notes" });
  }
};

// @desc   Recent finished sessions that still need a signed note
// @route  GET /api/notes/pending
export const getPendingNotes = async (req, res) => {
  try {
    const since = dateFromKey(addDaysToKey(todayKey(), -60));
    const sessions = await Session.find({
      therapist: req.therapist._id,
      status: "completed",
      date: { $gte: since },
    })
      .populate("client", "name email")
      .sort({ date: -1, startTime: -1 });

    const notes = await SessionNote.find({
      therapist: req.therapist._id,
      session: { $in: sessions.map((s) => s._id) },
      visibility: "private",
    }).select("session status");
    const noteBySession = Object.fromEntries(notes.map((n) => [String(n.session), n.status]));

    const pending = sessions
      .filter((s) => noteBySession[String(s._id)] !== "signed")
      .map((s) => ({
        sessionId: s._id,
        date: toDateKey(s.date),
        startTime: s.startTime,
        endTime: s.endTime,
        client: s.client ? { id: s.client._id, name: s.client.name } : null,
        noteStatus: noteBySession[String(s._id)] || null,
      }));

    return res.status(200).json({ pending });
  } catch (error) {
    console.error("Get pending notes error:", error.message);
    return res.status(500).json({ message: "Server error while fetching pending notes" });
  }
};

// @desc   The note for one session (or null), plus context for writing it
// @route  GET /api/notes/session/:sessionId
export const getNoteForSession = async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.sessionId,
      therapist: req.therapist._id,
    }).populate("client", "name email intake.presentingConcern");

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const visibility = visibilityOf(req.query.visibility);
    const both = await SessionNote.find({ session: session._id, therapist: req.therapist._id }).select("visibility status");
    const note = await populateNote(
      SessionNote.findOne({ session: session._id, therapist: req.therapist._id, visibility })
    );

    // The most recent signed note for this client from an earlier session,
    // so the therapist can see what was planned last time
    let previous = null;
    if (session.client) {
      const earlier = await populateNote(
        SessionNote.find({
          therapist: req.therapist._id,
          client: session.client._id,
          status: "signed",
          visibility: "private",
          session: { $ne: session._id },
        })
      );
      const before = earlier
        .filter((n) => n.session && toDateKey(n.session.date) <= toDateKey(session.date))
        .sort((a, b) => toDateKey(b.session.date).localeCompare(toDateKey(a.session.date)));
      if (before[0]) {
        const p = serializeNote(before[0]);
        previous = { id: p.id, date: p.session.date, plan: p.sections.plan, excerpt: p.excerpt };
      }
    }

    const sessionCount = session.client
      ? await Session.countDocuments({
          therapist: req.therapist._id,
          client: session.client._id,
          status: "completed",
        })
      : 0;

    return res.status(200).json({
      session: {
        id: session._id,
        date: toDateKey(session.date),
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
      },
      client: session.client
        ? {
            id: session.client._id,
            name: session.client.name,
            email: session.client.email,
            presentingConcern: session.client.intake?.presentingConcern || "",
            completedSessions: sessionCount,
          }
        : null,
      visibility,
      note: note ? serializeNote(note) : null,
      // Draft/signed state of both notes for this session, for the editor's tabs
      notes: Object.fromEntries(["private", "shared"].map((v) => [v, both.find((n) => n.visibility === v)?.status || null])),
      previous,
    });
  } catch (error) {
    console.error("Get session note error:", error.message);
    return res.status(500).json({ message: "Server error while fetching note" });
  }
};

// @desc   Create or update the draft note for a session (used by autosave)
// @route  PUT /api/notes/session/:sessionId
export const saveDraft = async (req, res) => {
  try {
    const visibility = visibilityOf(req.body.visibility);
    const { sections = {} } = req.body;
    // Shared notes are always free write; templates are for the private clinical record
    const template = visibility === "shared" ? "free" : req.body.template || "soap";

    if (!NOTE_TEMPLATES[template]) {
      return res.status(400).json({ message: "Unknown note template" });
    }

    const cleanSections = {};
    for (const key of NOTE_SECTION_KEYS) {
      const value = sections[key];
      if (value === undefined) continue;
      if (typeof value !== "string" || value.length > MAX_SECTION_LENGTH) {
        return res.status(400).json({ message: `The ${key} section is too long or invalid` });
      }
      cleanSections[`sections.${key}`] = RICH_SECTIONS.has(key) ? sanitizeRichText(value) : value;
    }

    const session = await Session.findOne({ _id: req.params.sessionId, therapist: req.therapist._id });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (!session.client) {
      return res.status(400).json({ message: "This session has no client attached" });
    }

    const existing = await SessionNote.findOne({ session: session._id, therapist: req.therapist._id, visibility });

    // Structured templates are a plan feature. A note that already uses one can
    // still be edited, so a downgrade never locks a therapist out of their own draft.
    if (template !== "free" && existing?.template !== template) {
      const access = await canAccess(req.therapist, "notes.structuredTemplates");
      if (!access.allowed) return upgradeRequired(res, access);
    }

    if (existing?.status === "signed") {
      return res.status(409).json({ message: "This note is signed and locked. Add an addendum instead." });
    }
    if (!existing && session.status === "cancelled") {
      return res.status(400).json({ message: "You can't write notes for a cancelled session" });
    }

    const note = await populateNote(
      SessionNote.findOneAndUpdate(
        { session: session._id, therapist: req.therapist._id, visibility },
        {
          $set: { template, ...cleanSections },
          $setOnInsert: { client: session.client, status: "draft", visibility },
        },
        { new: true, upsert: true, runValidators: true }
      )
    );

    return res.status(200).json({ message: "Draft saved", note: serializeNote(note) });
  } catch (error) {
    console.error("Save note error:", error.message);
    return res.status(500).json({ message: "Server error while saving note" });
  }
};

// @desc   Sign a draft, locking it from further edits
// @route  POST /api/notes/:id/sign
export const signNote = async (req, res) => {
  try {
    const note = await populateNote(SessionNote.findOne({ _id: req.params.id, therapist: req.therapist._id }));
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (note.status === "signed") {
      return res.status(400).json({ message: "Note is already signed" });
    }
    if (sectionText(note).every((t) => !t.trim())) {
      return res.status(400).json({ message: "Write something before signing the note" });
    }

    note.status = "signed";
    note.signedAt = new Date();
    if (note.visibility === "shared") note.sharedAt = note.signedAt;
    await note.save();

    // Let the client know a note is waiting in their space (the email never contains the note)
    if (note.visibility === "shared") {
      try {
        const client = await Client.findById(note.client._id || note.client);
        if (client && !client.archivedAt) {
          await sendSharedNoteEmail(client.email, client.name, req.therapist.name, await createPortalLink(client));
        }
      } catch (emailError) {
        console.error("Shared note email failed:", emailError.message);
      }
    }

    return res.status(200).json({
      message: note.visibility === "shared" ? "Note signed and shared with your client" : "Note signed",
      note: serializeNote(note),
    });
  } catch (error) {
    console.error("Sign note error:", error.message);
    return res.status(500).json({ message: "Server error while signing note" });
  }
};

// @desc   Add a dated addendum to a signed note
// @route  POST /api/notes/:id/addenda
export const addAddendum = async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    const note = await populateNote(SessionNote.findOne({ _id: req.params.id, therapist: req.therapist._id }));
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (note.status !== "signed") {
      return res.status(400).json({ message: "Drafts can be edited directly; addenda are for signed notes" });
    }

    note.addenda.push({ text });
    await note.save();

    return res.status(200).json({ message: "Addendum added", note: serializeNote(note) });
  } catch (error) {
    console.error("Add addendum error:", error.message);
    return res.status(500).json({ message: "Server error while adding addendum" });
  }
};

// @desc   Discard a draft note (signed notes can't be deleted)
// @route  DELETE /api/notes/:id
export const deleteDraft = async (req, res) => {
  try {
    const note = await SessionNote.findOne({ _id: req.params.id, therapist: req.therapist._id });
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (note.status === "signed") {
      return res.status(400).json({ message: "Signed notes are part of the clinical record and can't be deleted" });
    }

    await note.deleteOne();
    return res.status(200).json({ message: "Draft discarded" });
  } catch (error) {
    console.error("Delete note error:", error.message);
    return res.status(500).json({ message: "Server error while deleting note" });
  }
};
