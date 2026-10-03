import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { getNoteForSession, saveNoteDraft } from "../../api/notesApi";
import { TEMPLATES, SECTIONS, emptySections } from "./noteTemplates";
import { useEntitlement } from "../../context/entitlementContext";

const AUTOSAVE_DELAY = 1200;

const GrowingTextarea = ({ value, onChange, placeholder }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-none overflow-hidden bg-white border border-[#EFE6DA] rounded-xl px-3 py-2 text-sm leading-6 text-[#2B221E] placeholder-[#C4B8AC] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition"
    />
  );
};

// Compact, autosaving note editor for the side of the video room. Private to the
// therapist; signing happens in the full editor.
const LiveNotesPanel = ({ sessionId }) => {
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState(null);
  const [previous, setPrevious] = useState(null);
  const { can, promptUpgrade } = useEntitlement();
  const canStructured = can("notes.structuredTemplates");
  const [template, setTemplate] = useState(() => (canStructured ? "soap" : "free"));
  const [sections, setSections] = useState(emptySections);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [savedAt, setSavedAt] = useState(null);
  const [showPlan, setShowPlan] = useState(true);

  const edits = useRef(0);
  const latest = useRef({ template, sections });
  useLayoutEffect(() => {
    latest.current = { template, sections };
  });

  useEffect(() => {
    let alive = true;
    getNoteForSession(sessionId)
      .then((res) => {
        if (!alive) return;
        const n = res.data.note;
        setNote(n);
        setPrevious(res.data.previous);
        if (n) {
          setTemplate(n.template);
          setSections({ ...emptySections(), ...n.sections });
          setSavedAt(parseISO(n.updatedAt));
          setSaveState("saved");
        }
      })
      .catch(() => alive && setSaveState("error"))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const save = useCallback(async () => {
    const startedAt = edits.current;
    setSaveState("saving");
    try {
      const res = await saveNoteDraft(sessionId, latest.current);
      setNote(res.data.note);
      setSavedAt(new Date());
      if (edits.current === startedAt) {
        setDirty(false);
        setSaveState("saved");
      }
    } catch {
      setSaveState("error");
    }
  }, [sessionId]);

  useEffect(() => {
    if (!dirty) return undefined;
    const t = setTimeout(save, AUTOSAVE_DELAY);
    return () => clearTimeout(t);
  }, [dirty, sections, template, save]);

  // Don't lose the last few words if the therapist leaves the room right after typing
  useEffect(() => {
    const beforeUnload = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const templateLocked = (key) => key !== "free" && !canStructured && note?.template !== key;

  const edit = (patch) => {
    edits.current += 1;
    setDirty(true);
    setSaveState("dirty");
    patch();
  };

  if (!loaded) {
    return (
      <div className="p-4 space-y-3">
        <div className="skeleton h-8 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
      </div>
    );
  }

  const signed = note?.status === "signed";
  const statusText = {
    idle: "Not saved yet",
    dirty: "Unsaved…",
    saving: "Saving…",
    saved: savedAt ? `Saved ${format(savedAt, "h:mm a")}` : "Saved",
    error: "Couldn't save — keep typing to retry",
  }[saveState];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-4">
        {previous?.plan && (
          <div className="rounded-2xl bg-[#EEF3F0] border border-[#D7E5DC]">
            <button
              onClick={() => setShowPlan((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4F7161]">
                Plan from last session · {format(parseISO(previous.date), "MMM d")}
              </span>
              <span className="text-[#4F7161] text-xs">{showPlan ? "−" : "+"}</span>
            </button>
            {showPlan && (
              <p className="px-3.5 pb-3 text-sm text-[#2B3A33] leading-relaxed whitespace-pre-line">{previous.plan}</p>
            )}
          </div>
        )}

        {signed ? (
          <div className="rounded-2xl bg-[#FBF8F3] border border-[#F0E8DD] p-4 text-center">
            <p className="text-sm font-medium text-[#2B221E]">🔒 This note is signed</p>
            <p className="text-xs text-[#8A7A6D] mt-1">Add an addendum from the full editor.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-1.5">
              {Object.entries(TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() =>
                    templateLocked(key)
                      ? promptUpgrade("notes.structuredTemplates", "Unlock SOAP & DAP templates")
                      : key !== template && edit(() => setTemplate(key))
                  }
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    template === key
                      ? "bg-[#211A16] border-[#211A16] text-white font-semibold"
                      : "border-[#EFE6DA] text-[#6B5B52] hover:border-[#2B221E]/30"
                  }`}
                >
                  {t.label}
                  {templateLocked(key) && <span className="ml-1" aria-label="locked">🔒</span>}
                </button>
              ))}
            </div>

            {TEMPLATES[template].sections.map((key) => {
              const s = SECTIONS[key];
              return (
                <div key={key}>
                  <label className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-serif text-white"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.letter}
                    </span>
                    <span className="text-xs font-semibold text-[#2B221E]">{s.title}</span>
                  </label>
                  <GrowingTextarea
                    value={sections[key]}
                    placeholder={s.placeholder}
                    onChange={(v) => edit(() => setSections((prev) => ({ ...prev, [key]: v })))}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-[#F0E8DD] bg-white/80 text-[11px]">
        <span className={saveState === "error" ? "text-[#9C3B2E]" : "text-[#A89C8F]"}>{signed ? "Locked" : statusText}</span>
        <Link
          to={`/therapist/notes/session/${sessionId}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[#D96B00] hover:underline"
        >
          {signed ? "View note ↗" : "Full editor & sign ↗"}
        </Link>
      </div>
    </div>
  );
};

export default LiveNotesPanel;
