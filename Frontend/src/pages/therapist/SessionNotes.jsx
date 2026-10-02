import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ClientAvatar from "../../components/appointments/ClientAvatar";
import { getNotes, getPendingNotes } from "../../api/notesApi";
import { TEMPLATES } from "../../components/notes/noteTemplates";
import { apiError, formatShortDate, formatTime } from "../../components/appointments/appointmentUtils";

const TABS = [
  { key: "all", label: "All notes" },
  { key: "draft", label: "Drafts" },
  { key: "signed", label: "Signed" },
];

const PendingCard = ({ item }) => (
  <Link
    to={`/therapist/notes/session/${item.sessionId}`}
    className="group shrink-0 w-60 rounded-3xl bg-white border border-[#F6DFA8] p-4 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(183,121,31,0.12)] transition-all"
  >
    <div className="flex items-center gap-3 mb-3">
      <ClientAvatar name={item.client?.name} size="sm" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#2B221E] truncate">{item.client?.name || "Unknown client"}</p>
        <p className="text-xs text-[#8A7A6D]">
          {formatShortDate(item.date)} · {formatTime(item.startTime)}
        </p>
      </div>
    </div>
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B7791F] group-hover:text-[#8A5A12]">
      {item.noteStatus === "draft" ? "Finish draft" : "Write note"} →
    </span>
  </Link>
);

const NoteCard = ({ note }) => {
  const signed = note.status === "signed";
  return (
    <Link
      to={`/therapist/notes/session/${note.sessionId}`}
      className="group block rounded-3xl bg-white border border-[#EFE6DA] p-5 hover:border-[#FFD9AE] hover:shadow-[0_10px_30px_rgba(217,107,0,0.08)] transition-all animate-fade-up"
    >
      <div className="flex items-start gap-3">
        <ClientAvatar name={note.client?.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-[#2B221E] truncate group-hover:text-[#D96B00] transition">
              {note.client?.name || "Unknown client"}
            </p>
            <span className="text-[10px] font-semibold tracking-wider text-[#8A7A6D] bg-[#F3EEE6] px-2 py-0.5 rounded-full">
              {TEMPLATES[note.template]?.label}
            </span>
          </div>
          <p className="text-xs text-[#A89C8F] mt-0.5">
            {note.session ? `Session ${formatShortDate(note.session.date)} · ${formatTime(note.session.startTime)}` : "Session removed"}
          </p>
        </div>
        <span
          className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            signed ? "bg-[#EEF3F0] text-[#4F7161]" : "bg-[#FFF8E6] text-[#B7791F]"
          }`}
        >
          {signed ? "🔒 Signed" : "Draft"}
        </span>
      </div>

      <p className={`text-sm leading-relaxed mt-3 line-clamp-2 ${note.excerpt ? "text-[#4A413A]" : "text-[#C4B8AC] italic"}`}>
        {note.excerpt || "Empty draft"}
      </p>

      <div className="flex items-center gap-3 mt-3 text-[11px] text-[#A89C8F]">
        <span>{note.wordCount} words</span>
        <span>·</span>
        <span>
          {signed ? "Signed" : "Edited"} {formatDistanceToNow(parseISO(signed ? note.signedAt : note.updatedAt), { addSuffix: true })}
        </span>
        {note.addenda.length > 0 && (
          <>
            <span>·</span>
            <span>
              {note.addenda.length} addend{note.addenda.length > 1 ? "a" : "um"}
            </span>
          </>
        )}
      </div>
    </Link>
  );
};

const SessionNotes = () => {
  const [notes, setNotes] = useState(null);
  const [counts, setCounts] = useState({});
  const [pending, setPending] = useState([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([getNotes(), getPendingNotes()])
      .then(([notesRes, pendingRes]) => {
        if (!alive) return;
        setNotes(notesRes.data.notes);
        setCounts(notesRes.data.counts);
        setPending(pendingRes.data.pending);
      })
      .catch((err) => alive && setError(apiError(err, "Couldn't load your notes.")));
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => {
    if (!notes) return [];
    const q = search.trim().toLowerCase();
    return notes.filter(
      (n) =>
        (tab === "all" || n.status === tab) &&
        (!q || n.client?.name.toLowerCase().includes(q) || n.excerpt.toLowerCase().includes(q))
    );
  }, [notes, tab, search]);

  return (
    <DashboardLayout>
      <div className="p-5 sm:p-8 max-w-5xl w-full mx-auto">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D96B00] mb-2">Clinical records</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight">Session notes</h1>
          <p className="text-[#6B5B52] text-sm mt-2">Private to you — never shared with clients.</p>
        </div>

        {error && <p className="rounded-2xl bg-[#FDECEA] text-[#9C3B2E] text-sm px-4 py-3 mb-6">{error}</p>}

        {/* Sessions that still need a note */}
        {pending.length > 0 && (
          <section className="mb-8 rounded-[28px] bg-gradient-to-br from-[#FFF8E6] to-[#FFFDF9] border border-[#F6DFA8] p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-[#B7791F] text-white text-sm font-bold flex items-center justify-center">
                {pending.length}
              </span>
              <div>
                <h2 className="font-serif text-lg text-[#2B221E] leading-tight">Waiting for notes</h2>
                <p className="text-xs text-[#8A7A6D]">Completed sessions from the last 60 days without a signed note</p>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto scroll-thin pb-2 -mx-1 px-1">
              {pending.map((p) => (
                <PendingCard key={p.sessionId} item={p} />
              ))}
            </div>
          </section>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex gap-1 p-1 bg-[#F3EBDF]/70 rounded-2xl self-start">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                  tab === t.key ? "bg-white text-[#2B221E] shadow-sm" : "text-[#8A7A6D] hover:text-[#2B221E]"
                }`}
              >
                {t.label}
                {counts[t.key] > 0 && (
                  <span className="text-[11px] min-w-5 h-5 px-1.5 rounded-full bg-white/70 text-[#8A7A6D] flex items-center justify-center">
                    {counts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client or note text…"
            className="sm:ml-auto sm:w-72 bg-white border border-[#E5DCD3] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition"
          />
        </div>

        {!notes && !error ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-40 rounded-3xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 px-6 rounded-3xl border border-dashed border-[#E5DCD3] bg-white/50">
            <p className="font-serif text-lg text-[#2B221E]">
              {search ? "No matching notes" : tab === "draft" ? "No drafts" : tab === "signed" ? "No signed notes yet" : "No notes yet"}
            </p>
            <p className="text-sm text-[#8A7A6D] mt-1 max-w-sm mx-auto">
              Open any session from Appointments and choose “Write notes”, or start from the list above.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {visible.map((n) => (
              <NoteCard key={n.id} note={n} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SessionNotes;
