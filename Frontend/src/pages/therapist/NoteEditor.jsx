import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ClientAvatar from "../../components/appointments/ClientAvatar";
import Modal from "../../components/appointments/Modal";
import {
  getNoteForSession,
  saveNoteDraft,
  signNote,
  addNoteAddendum,
  deleteNoteDraft,
} from "../../api/notesApi";
import { TEMPLATES, SECTIONS, emptySections, countWords } from "../../components/notes/noteTemplates";
import { apiError, formatLongDate, formatTime } from "../../components/appointments/appointmentUtils";
import { useToast } from "../../context/toastContext";
import { useEntitlement } from "../../context/entitlementContext";
import RichTextEditor, { RichTextView } from "../../components/notes/RichTextEditor";

const AUTOSAVE_DELAY = 1200;

// Textarea that grows with its content
const AutoTextarea = ({ value, onChange, placeholder, readOnly, minRows = 4 }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-none bg-transparent text-[15px] leading-7 text-[#2B221E] placeholder-[#C4B8AC] focus:outline-none"
    />
  );
};

const SaveIndicator = ({ state, savedAt }) => {
  const map = {
    idle: { dot: "bg-[#C4B8AC]", text: "Not saved yet" },
    dirty: { dot: "bg-[#FFB877]", text: "Unsaved changes" },
    saving: { dot: "bg-[#FF9E4C] animate-pulse", text: "Saving…" },
    saved: { dot: "bg-[#6B9080]", text: savedAt ? `Saved ${format(savedAt, "h:mm a")}` : "Saved" },
    error: { dot: "bg-[#C8553D]", text: "Couldn't save — retrying when you type" },
  };
  const s = map[state];
  return (
    <span className="flex items-center gap-2 text-xs text-[#8A7A6D]" aria-live="polite">
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
};

const NoteEditor = ({ visibility }) => {
  const { sessionId } = useParams();
  const [, setParams] = useSearchParams();
  const shared = visibility === "shared";
  const navigate = useNavigate();
  const { notify } = useToast();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [note, setNote] = useState(null);
  const { can, promptUpgrade } = useEntitlement();
  const canStructured = can("notes.structuredTemplates");
  // New notes start with SOAP when the plan includes it, otherwise free write
  // Shared notes are always free write (rich text); private notes start with SOAP when the plan has it
  const [template, setTemplate] = useState(() => (shared || !canStructured ? "free" : "soap"));
  const [sections, setSections] = useState(emptySections);
  const [saveState, setSaveState] = useState("idle");
  const [savedAt, setSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [confirmSign, setConfirmSign] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addendum, setAddendum] = useState("");

  const editCounter = useRef(0);
  // Latest values for the autosave callback, without re-creating it on every keystroke
  const latest = useRef({ template, sections });
  useLayoutEffect(() => {
    latest.current = { template, sections };
  });

  useEffect(() => {
    let alive = true;
    getNoteForSession(sessionId, visibility)
      .then((res) => {
        if (!alive) return;
        setData(res.data);
        const n = res.data.note;
        setNote(n);
        if (n) {
          setTemplate(n.template);
          setSections({ ...emptySections(), ...n.sections });
          setSaveState("saved");
          setSavedAt(parseISO(n.updatedAt));
        }
      })
      .catch((err) => alive && setLoadError(apiError(err, "Couldn't load this session.")));
    return () => {
      alive = false;
    };
  }, [sessionId, visibility]);

  const locked = note?.status === "signed";

  const save = useCallback(async () => {
    const startedAt = editCounter.current;
    setSaveState("saving");
    try {
      const res = await saveNoteDraft(sessionId, { ...latest.current, visibility });
      setNote(res.data.note);
      setData((d) => (d ? { ...d, notes: { ...d.notes, [visibility]: res.data.note.status } } : d));
      setSavedAt(new Date());
      if (editCounter.current === startedAt) {
        setDirty(false);
        setSaveState("saved");
      } else {
        setSaveState("dirty");
      }
      return true;
    } catch (err) {
      setSaveState("error");
      notify(apiError(err, "Couldn't save your note."), { type: "error" });
      return false;
    }
  }, [sessionId, visibility, notify]);

  // Autosave shortly after typing stops
  useEffect(() => {
    if (!dirty || locked) return undefined;
    const t = setTimeout(save, AUTOSAVE_DELAY);
    return () => clearTimeout(t);
  }, [dirty, sections, template, locked, save]);

  // Warn before leaving with unsaved text; Ctrl/Cmd+S saves immediately
  useEffect(() => {
    const beforeUnload = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !locked) save();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", onKey);
    };
  }, [dirty, locked, save]);

  // Structured templates need the plan feature, unless this note already uses one
  const templateLocked = (key) => key !== "free" && !canStructured && note?.template !== key;

  const switchTo = async (target) => {
    if (target === visibility) return;
    if (dirty && !locked && !(await save())) return;
    setParams(target === "shared" ? { v: "shared" } : {}, { replace: true });
  };

  const markEdited = () => {
    editCounter.current += 1;
    setDirty(true);
    setSaveState("dirty");
  };

  const updateSection = (key, value) => {
    setSections((prev) => ({ ...prev, [key]: value }));
    markEdited();
  };

  const changeTemplate = (t) => {
    if (t === template) return;
    setTemplate(t);
    markEdited();
  };

  const handleSign = async () => {
    setBusy(true);
    if (dirty && !(await save())) {
      setBusy(false);
      return;
    }
    try {
      const id = note?.id;
      if (!id) throw new Error("Write something before signing the note");
      const res = await signNote(id);
      setNote(res.data.note);
      setData((d) => (d ? { ...d, notes: { ...d.notes, [visibility]: "signed" } } : d));
      setConfirmSign(false);
      notify(shared ? `Shared with ${data?.client?.name || "your client"}` : "Note signed and locked");
    } catch (err) {
      notify(apiError(err, err.message), { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = async () => {
    setBusy(true);
    try {
      if (note?.id) await deleteNoteDraft(note.id);
      setDirty(false);
      notify("Draft discarded", { type: "info" });
      navigate("/therapist/notes");
    } catch (err) {
      notify(apiError(err), { type: "error" });
      setBusy(false);
    }
  };

  const handleAddendum = async () => {
    if (!addendum.trim()) return;
    setBusy(true);
    try {
      const res = await addNoteAddendum(note.id, addendum.trim());
      setNote(res.data.note);
      setAddendum("");
      notify("Addendum added");
    } catch (err) {
      notify(apiError(err), { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="p-8 max-w-xl mx-auto text-center">
          <p className="text-[#6B5B52] mb-4">{loadError}</p>
          <Link to="/therapist/notes" className="text-sm font-semibold text-[#D96B00] hover:underline">
            ← Back to session notes
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="p-5 sm:p-8 max-w-6xl mx-auto grid lg:grid-cols-[280px_1fr] gap-6">
          <div className="skeleton h-72 rounded-3xl" />
          <div className="skeleton h-[520px] rounded-3xl" />
        </div>
      </DashboardLayout>
    );
  }

  const { session, client, previous } = data;
  const words = countWords(template, sections);
  const cancelled = session.status === "cancelled";

  return (
    <DashboardLayout>
      <div className="p-5 sm:p-8 max-w-6xl w-full mx-auto">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link to="/therapist/notes" className="text-sm text-[#D96B00] hover:underline">
            ← Session notes
          </Link>
          <div className="flex items-center gap-3">
            {locked ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#4F7161] bg-[#EEF3F0] px-3 py-1.5 rounded-full">
                🔒 Signed {format(parseISO(note.signedAt), "MMM d, yyyy · h:mm a")}
              </span>
            ) : (
              <>
                <SaveIndicator state={saveState} savedAt={savedAt} />
                {note && (
                  <button
                    onClick={() => setConfirmDiscard(true)}
                    className="text-sm font-medium text-[#8A7A6D] hover:text-[#9C3B2E] px-3 py-2 rounded-full hover:bg-[#FDECEA] transition"
                  >
                    Discard
                  </button>
                )}
                <button
                  onClick={() => setConfirmSign(true)}
                  disabled={words === 0 || busy}
                  className="text-sm font-semibold px-5 py-2.5 rounded-full bg-[#211A16] text-white hover:bg-[#3A2E27] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {shared ? "Sign & share" : "Sign & lock"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* Context column */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="relative overflow-hidden rounded-3xl bg-[#211A16] text-white p-5">
              <div
                className="pointer-events-none absolute -top-16 -right-12 w-44 h-44 rounded-full opacity-50 blur-2xl"
                style={{ background: "radial-gradient(circle, #FF9E4C 0%, #C9602E 50%, transparent 75%)" }}
              />
              <div className="relative flex items-center gap-3 mb-4">
                <ClientAvatar name={client?.name} />
                <div className="min-w-0">
                  <p className="font-serif text-lg leading-tight truncate">{client?.name || "Unknown client"}</p>
                  {client && (
                    <Link to={`/therapist/clients/${client.id}`} className="text-xs text-[#FFB877] hover:underline">
                      View profile
                    </Link>
                  )}
                </div>
              </div>
              <p className="relative text-sm text-[#D8C9BC]">{formatLongDate(session.date)}</p>
              <p className="relative text-sm text-white/90">
                {formatTime(session.startTime)} – {formatTime(session.endTime)}
              </p>
              {client?.completedSessions > 0 && (
                <p className="relative text-xs text-white/50 mt-2">
                  {client.completedSessions} completed session{client.completedSessions > 1 ? "s" : ""} together
                </p>
              )}
            </div>

            {previous?.plan && (
              <div className="rounded-3xl bg-[#EEF3F0] border border-[#D7E5DC] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4F7161] mb-1">
                  Plan from last session
                </p>
                <p className="text-[11px] text-[#4F7161]/70 mb-2">{format(parseISO(previous.date), "MMM d")}</p>
                <p className="text-sm text-[#2B3A33] leading-relaxed whitespace-pre-line">{previous.plan}</p>
              </div>
            )}

            {client?.presentingConcern && (
              <div className="rounded-3xl bg-[#FFF8F0] border border-[#FFE3C2] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D96B00]/80 mb-2">
                  What brought them in
                </p>
                <p className="text-sm text-[#4A413A] leading-relaxed">{client.presentingConcern}</p>
              </div>
            )}

            <p className="text-[11px] text-[#A89C8F] px-2 leading-relaxed">
              {shared
                ? locked
                  ? `👁 Shared — ${client?.name || "your client"} can read this note in their client space.`
                  : "👁 This note is for your client. They'll see it in their client space once you sign & share it."
                : "🔐 Private notes are only for you. They're never sent to clients or shown on your public page."}
            </p>
          </aside>

          {/* Editor */}
          <main className="rounded-3xl bg-white border border-[#EFE6DA] overflow-hidden">
            <div className="flex border-b border-[#F3EBDF] bg-[#FBF8F3]" role="tablist">
              {[
                ["private", "🔒 Private note", "Your clinical record"],
                ["shared", "👁 Shared with client", "Summary or homework"],
              ].map(([key, label, hint]) => {
                const active = key === visibility;
                const state = data.notes?.[key];
                return (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchTo(key)}
                    className={`flex-1 text-left px-5 py-3.5 border-b-2 transition ${
                      active ? "bg-white border-[#D96B00]" : "border-transparent hover:bg-white/60"
                    }`}
                  >
                    <span className={`block text-sm font-semibold ${active ? "text-[#2B221E]" : "text-[#8A7A6D]"}`}>{label}</span>
                    <span className="block text-[11px] text-[#A89C8F]">
                      {state === "signed" ? (key === "shared" ? "Shared ✓" : "Signed ✓") : state === "draft" ? "Draft" : hint}
                    </span>
                  </button>
                );
              })}
            </div>
            {cancelled && !note && (
              <p className="m-6 text-sm text-[#9C3B2E] bg-[#FDECEA] rounded-2xl px-4 py-3">
                This session was cancelled, so notes can't be added.
              </p>
            )}

            {!shared && !locked && !(cancelled && !note) && (
              <div className="flex flex-wrap items-center gap-2 px-6 pt-5 pb-4 border-b border-[#F3EBDF]">
                {Object.entries(TEMPLATES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() =>
                      templateLocked(key) ? promptUpgrade("notes.structuredTemplates", "Unlock SOAP & DAP templates") : changeTemplate(key)
                    }
                    title={t.description}
                    className={`text-sm px-4 py-2 rounded-full border transition ${
                      template === key
                        ? "bg-[#211A16] border-[#211A16] text-white font-semibold"
                        : "border-[#EFE6DA] text-[#6B5B52] hover:border-[#2B221E]/30"
                    }`}
                  >
                    {t.label}
                    {templateLocked(key) && <span className="ml-1" aria-label="locked">🔒</span>}
                  </button>
                ))}
                <span className="text-xs text-[#A89C8F] ml-1 hidden sm:inline">{TEMPLATES[template].description}</span>
              </div>
            )}

            {!(cancelled && !note) && (
              <div className="divide-y divide-[#F6F0E8]">
                {TEMPLATES[template].sections.map((key) => {
                  const s = SECTIONS[key];
                  if (locked && !sections[key]?.replace(/<[^>]+>/g, "").trim()) return null;
                  const title = key === "body" && shared ? `Note for ${client?.name || "your client"}` : s.title;
                  return (
                    <section key={key} className="px-6 py-5 flex gap-4 group">
                      <span
                        className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center font-serif text-lg text-white mt-0.5 transition-transform group-focus-within:scale-110"
                        style={{ backgroundColor: s.color }}
                        aria-hidden="true"
                      >
                        {s.letter}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[#2B221E]">{title}</h3>
                        {!locked && (
                          <p className="text-xs text-[#A89C8F] mb-2">
                            {key === "body" && shared ? "A summary, exercises or homework, written to your client." : s.hint}
                          </p>
                        )}
                        {locked ? (
                          key === "body" ? (
                            <RichTextView html={sections[key]} className="mt-1" />
                          ) : (
                            <p className="text-[15px] leading-7 text-[#2B221E] whitespace-pre-line mt-1">{sections[key]}</p>
                          )
                        ) : key === "body" ? (
                          <RichTextEditor
                            value={sections[key]}
                            onChange={(v) => updateSection(key, v)}
                            placeholder={shared ? "Hi … Here's a summary of what we covered today…" : s.placeholder}
                            minHeight={shared ? 260 : 300}
                          />
                        ) : (
                          <AutoTextarea
                            value={sections[key]}
                            onChange={(v) => updateSection(key, v)}
                            placeholder={s.placeholder}
                            minRows={key === "body" ? 12 : 3}
                          />
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            <div className="px-6 py-3 bg-[#FBF8F3] border-t border-[#F3EBDF] flex items-center justify-between text-xs text-[#A89C8F]">
              <span>
                {words} word{words === 1 ? "" : "s"}
              </span>
              {!locked && <span className="hidden sm:inline">Autosaves as you type · Ctrl+S to save now</span>}
            </div>

            {/* Addenda */}
            {locked && (
              <div className="px-6 py-6 border-t border-[#F3EBDF]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A89C8F] mb-3">Addenda</h3>
                {note.addenda.length > 0 && (
                  <ol className="space-y-3 mb-4">
                    {note.addenda.map((a) => (
                      <li key={a.id} className="rounded-2xl bg-[#FBF8F3] border border-[#F0E8DD] px-4 py-3">
                        <p className="text-[11px] text-[#A89C8F] mb-1">
                          {format(parseISO(a.createdAt), "MMM d, yyyy · h:mm a")}
                        </p>
                        <p className="text-sm text-[#2B221E] whitespace-pre-line">{a.text}</p>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="text-xs text-[#8A7A6D] mb-2">
                  Signed notes can't be edited. Add a dated addendum to correct or extend the record.
                </p>
                <textarea
                  rows={3}
                  value={addendum}
                  onChange={(e) => setAddendum(e.target.value)}
                  maxLength={5000}
                  placeholder="Write an addendum…"
                  className="w-full bg-white border border-[#EFE6DA] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddendum}
                    disabled={!addendum.trim() || busy}
                    className="text-sm font-semibold px-5 py-2 rounded-full bg-[#211A16] text-white hover:bg-[#3A2E27] transition disabled:opacity-40"
                  >
                    Add addendum
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {confirmSign && (
        <Modal
          open
          onClose={() => setConfirmSign(false)}
          title={shared ? `Sign and share with ${client?.name || "your client"}?` : "Sign and lock this note?"}
          subtitle={shared ? "Your client will be able to read this note." : "Signed notes become part of the clinical record."}
          footer={
            <>
              <button
                onClick={() => setConfirmSign(false)}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B5B52] hover:bg-[#F3EBDF] transition"
              >
                Keep editing
              </button>
              <button
                onClick={handleSign}
                disabled={busy}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#211A16] text-white hover:bg-[#3A2E27] transition disabled:opacity-50"
              >
                {busy ? "Signing…" : shared ? "Sign & share" : "Sign & lock"}
              </button>
            </>
          }
        >
          <ul className="space-y-2 text-sm text-[#4A413A]">
            {shared && (
              <li className="flex gap-2">
                <span className="text-[#4F7161]">✓</span> It appears in {client?.name || "your client"}'s client space, and
                they get an email saying a note is waiting (the email doesn't include the note).
              </li>
            )}
            <li className="flex gap-2">
              <span className="text-[#4F7161]">✓</span> The note can no longer be edited or deleted.
            </li>
            <li className="flex gap-2">
              <span className="text-[#4F7161]">✓</span> You can still add dated addenda to it later.
            </li>
            <li className="flex gap-2">
              <span className="text-[#4F7161]">✓</span> It's stamped with today's date and time.
            </li>
          </ul>
        </Modal>
      )}

      {confirmDiscard && (
        <Modal
          open
          onClose={() => setConfirmDiscard(false)}
          title="Discard this draft?"
          subtitle="The draft will be deleted. This can't be undone."
          footer={
            <>
              <button
                onClick={() => setConfirmDiscard(false)}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B5B52] hover:bg-[#F3EBDF] transition"
              >
                Keep draft
              </button>
              <button
                onClick={handleDiscard}
                disabled={busy}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#C8553D] text-white hover:bg-[#A9432E] transition disabled:opacity-50"
              >
                Discard draft
              </button>
            </>
          }
        >
          <p className="text-sm text-[#6B5B52]">
            {words} word{words === 1 ? "" : "s"} for {client?.name}'s session on {formatLongDate(session.date)}.
          </p>
        </Modal>
      )}
    </DashboardLayout>
  );
};

const NoteEditorPage = () => {
  const [params] = useSearchParams();
  const visibility = params.get("v") === "shared" ? "shared" : "private";
  return <NoteEditor key={visibility} visibility={visibility} />;
};

export default NoteEditorPage;
