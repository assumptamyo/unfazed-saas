import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO, differenceInMinutes, isToday, isTomorrow } from "date-fns";
import ChatThread from "../../components/chat/ChatThread";
import { useConversation } from "../../hooks/useConversation";
import { disconnectSocket } from "../../hooks/useSocket";
import {
  getClientToken,
  getPortal,
  getPortalMessages,
  sendPortalMessage,
  markPortalRead,
  leavePortal,
  getPortalNotes,
} from "../../api/portalApi";
import { RichTextView } from "../../components/notes/RichTextEditor";

const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);
  return now;
};

const dayText = (dateKey) => {
  const d = parseISO(dateKey);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMMM d");
};

const JoinButton = ({ session, now, big }) => {
  const opens = parseISO(session.joinOpensAt);
  const open = now >= opens;
  const base = big ? "px-6 py-3 text-sm" : "px-4 py-2 text-xs";
  if (open) {
    return (
      <Link
        to={`/portal/session/${session.id}`}
        className={`${base} inline-flex items-center gap-2 rounded-full font-semibold bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition`}
      >
        <span className="w-2 h-2 rounded-full bg-[#211A16] animate-pulse" />
        Join video session
      </Link>
    );
  }
  return (
    <span className={`${base} inline-block rounded-full font-medium ${big ? "bg-white/10 text-white/80" : "bg-[#F3EEE6] text-[#8A7A6D]"}`}>
      Room opens {isToday(opens) ? `at ${format(opens, "h:mm a")}` : format(opens, "MMM d, h:mm a")}
    </span>
  );
};

const Messages = ({ portal }) => {
  const conversation = useConversation({
    token: getClientToken(),
    clientId: portal.client.id,
    me: "client",
    fetchPage: async (before) => (await getPortalMessages(before)).data,
    send: async (text) => (await sendPortalMessage(text)).data.message,
    markRead: () => markPortalRead(),
  });
  const first = portal.therapist?.name || "your therapist";
  return (
    <section className="bg-[#FFFDF9] border border-[#EFE6DA] rounded-[28px] overflow-hidden flex flex-col h-[560px] lg:h-[calc(100vh-180px)] lg:min-h-[520px]">
      <div className="px-5 py-4 border-b border-[#F0E8DD]">
        <h2 className="font-serif text-lg text-[#2B221E]">Messages</h2>
        <p className="text-xs text-[#A89C8F]">Private between you and {first} · not for emergencies</p>
      </div>
      <div className="flex-1 min-h-0">
        <ChatThread
          messages={conversation.messages}
          hasMore={conversation.hasMore}
          onLoadMore={conversation.loadMore}
          loading={conversation.loading}
          me="client"
          otherName={first}
          onSend={conversation.sendText}
        otherTyping={conversation.otherTyping}
        onTyping={conversation.notifyTyping}
          emptyHint={`Send ${first} a message about scheduling or anything between sessions.`}
        />
      </div>
    </section>
  );
};

// Notes the therapist chose to share. The server only ever sends shared, signed notes here.
const SharedNotes = ({ therapistName }) => {
  const [notes, setNotes] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    getPortalNotes()
      .then((res) => {
        setNotes(res.data.notes);
        setOpen(res.data.notes[0]?.id ?? null);
      })
      .catch(() => setNotes([]));
  }, []);

  if (!notes || notes.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#A89C8F] mb-3">Notes from {therapistName}</h2>
      <div className="space-y-2">
        {notes.map((n) => {
          const expanded = open === n.id;
          return (
            <div key={n.id} className="bg-white border border-[#EFE6DA] rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpen(expanded ? null : n.id)}
                aria-expanded={expanded}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#FBF8F3] transition"
              >
                <span>
                  <span className="block text-sm font-medium text-[#2B221E]">
                    {n.session ? `Session on ${format(parseISO(n.session.date), "EEE, MMM d")}` : "Note"}
                  </span>
                  <span className="block text-xs text-[#A89C8F]">Shared {format(parseISO(n.sharedAt), "MMM d, yyyy")}</span>
                </span>
                <span className={`text-[#D96B00] transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
              </button>
              {expanded && (
                <div className="px-5 pb-5 pt-1 border-t border-[#F6F0E8] animate-fade-in">
                  <RichTextView html={n.html} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

const PortalHome = () => {
  const navigate = useNavigate();
  const now = useNow();
  const [portal, setPortal] = useState(null);
  const [error, setError] = useState(() => (getClientToken() ? "" : "missing"));

  useEffect(() => {
    if (!getClientToken()) return;
    getPortal()
      .then((res) => setPortal(res.data))
      .catch((err) => {
        if (err.response?.status === 401) leavePortal();
        setError(err.response?.data?.message || "Couldn't load your space.");
      });
  }, []);

  const signOut = () => {
    disconnectSocket(getClientToken());
    leavePortal();
    navigate("/portal/login", { state: { signedOut: true } });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D96B00] mb-4">Unfazed</p>
          <h1 className="font-serif text-2xl text-[#2B221E] mb-2">Sign in to your sessions</h1>
          <p className="text-sm text-[#6B5B52]">
            {error === "missing" ? "We'll email you a code — no password needed." : error}
          </p>
          <Link
            to="/portal/login"
            className="inline-block mt-6 px-6 py-3 rounded-full text-sm font-semibold bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition"
          >
            Sign in with email
          </Link>
        </div>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] p-6 max-w-6xl mx-auto grid lg:grid-cols-[1fr_400px] gap-6">
        <div className="skeleton h-64 rounded-[28px]" />
        <div className="skeleton h-96 rounded-[28px]" />
      </div>
    );
  }

  const { client, therapist, upcoming, past } = portal;
  const [next, ...later] = upcoming;
  const minsToNext = next ? differenceInMinutes(parseISO(`${next.date}T${next.startTime}`), now) : null;

  return (
    <div className="min-h-screen bg-[#F9F6F0]">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-8 py-5">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D96B00]">Unfazed</span>
        <button onClick={signOut} className="text-sm text-[#8A7A6D] hover:text-[#2B221E]">
          Sign out
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-8 pb-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
        {/* min-w-0 lets long text (e.g. qualifications) truncate instead of widening the page */}
        <div className="space-y-6 min-w-0">
          <div>
            <p className="text-sm text-[#8A7A6D]">Your private space</p>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight">Hi, {client.name}</h1>
          </div>

          {/* Therapist */}
          {therapist && (
            <div className="flex items-center gap-4 bg-white border border-[#EFE6DA] rounded-3xl p-4">
              {therapist.photoUrl ? (
                <img src={therapist.photoUrl} alt="" className="w-14 h-14 rounded-2xl object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#FFE3C2] text-[#D96B00] font-serif text-xl flex items-center justify-center">
                  {therapist.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#A89C8F]">Your therapist</p>
                <p className="font-medium text-[#2B221E] truncate">{therapist.name}</p>
                {therapist.qualifications && <p className="text-xs text-[#8A7A6D] truncate">{therapist.qualifications}</p>}
              </div>
              <Link
                to={`/${therapist.slug}`}
                className="shrink-0 text-xs font-semibold px-3.5 py-2 rounded-full border border-[#EFE6DA] text-[#6B5B52] hover:border-[#FF9E4C] hover:text-[#D96B00] transition"
              >
                Book a session
              </Link>
            </div>
          )}

          {/* Next session */}
          {next ? (
            <div className="relative overflow-hidden rounded-[28px] bg-[#211A16] text-white p-6 sm:p-8">
              <div
                className="pointer-events-none absolute -top-28 -right-20 w-80 h-80 rounded-full opacity-60 blur-3xl"
                style={{ background: "radial-gradient(circle, #FF9E4C 0%, #C9602E 45%, transparent 75%)" }}
              />
              <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-[#FFB877] mb-4">Your next session</p>
              <p className="relative font-serif text-3xl sm:text-4xl leading-tight">{dayText(next.date)}</p>
              <p className="relative text-lg text-[#D8C9BC] mt-1">
                {next.startTime} – {next.endTime} · Video
              </p>
              {minsToNext > 0 && minsToNext < 24 * 60 && (
                <p className="relative text-sm text-white/60 mt-1">
                  in {minsToNext >= 60 ? `${Math.floor(minsToNext / 60)}h ${minsToNext % 60}m` : `${minsToNext} min`}
                </p>
              )}
              <div className="relative mt-6">
                <JoinButton session={next} now={now} big />
              </div>
              <p className="relative text-xs text-white/40 mt-4">The room opens 10 minutes before your session.</p>
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-[#E5DCD3] bg-white/60 p-8 text-center">
              <p className="font-serif text-xl text-[#2B221E]">No upcoming sessions</p>
              {therapist && (
                <Link to={`/${therapist.slug}`} className="inline-block mt-3 text-sm font-semibold text-[#D96B00] hover:underline">
                  Book a time with {therapist.name} →
                </Link>
              )}
            </div>
          )}

          {later.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#A89C8F] mb-3">Coming up</h2>
              <div className="space-y-2">
                {later.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 bg-white border border-[#EFE6DA] rounded-2xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#2B221E]">{dayText(s.date)}</p>
                      <p className="text-xs text-[#8A7A6D]">{s.startTime} – {s.endTime} · Video</p>
                    </div>
                    <JoinButton session={s} now={now} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#A89C8F] mb-3">Past sessions</h2>
              <div className="bg-white border border-[#EFE6DA] rounded-2xl divide-y divide-[#F6F0E8]">
                {past.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-[#2B221E]">{format(parseISO(s.date), "EEE, MMM d")}</span>
                    <span className="text-xs text-[#8A7A6D] capitalize">{s.status === "confirmed" ? "completed" : s.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <SharedNotes therapistName={therapist?.name || "your therapist"} />
        </div>

        <Messages portal={portal} />
      </main>
    </div>
  );
};

export default PortalHome;
