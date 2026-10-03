import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInMinutes, format, parseISO } from "date-fns";
import VideoStage from "./VideoStage";
import ChatThread from "../chat/ChatThread";
import ClientAvatar from "../appointments/ClientAvatar";

const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
};

const statusLine = (session, now) => {
  const start = parseISO(`${session.date}T${session.startTime}`);
  const end = parseISO(`${session.date}T${session.endTime}`);
  if (now < start) {
    const mins = differenceInMinutes(start, now);
    return mins < 60 ? `Starts in ${mins} min` : `Starts at ${format(start, "h:mm a")}`;
  }
  if (now < end) return `${differenceInMinutes(end, now)} min remaining`;
  return "Session time has ended";
};

// Full-screen room: video on the left, chat on the right (stacked on phones).
//   session: { date, startTime, endTime }
//   other:   { name } - the person on the other side
//   conversation: result of useConversation
//   notesPanel: optional element (therapist only) shown in a "Notes" tab beside the video
const SessionRoom = ({ session, other, me, backTo, backLabel, join, displayName, conversation, notesPanel }) => {
  const now = useClock();
  const [panel, setPanel] = useState(notesPanel ? "notes" : "chat");
  const unseen = conversation.messages.filter((m) => m.sender !== me && !m.readAt).length;

  const tabs = [
    { key: "chat", label: "Chat", badge: panel !== "chat" ? unseen : 0 },
    ...(notesPanel ? [{ key: "notes", label: "Notes", badge: 0 }] : []),
  ];

  // Clicking the open tab again hides the side panel to give the video more room
  const toggle = (key) => setPanel((current) => (current === key ? null : key));

  return (
    <div className="h-screen flex flex-col bg-[#F3EDE4]">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-[#FFFDF9] border-b border-[#EFE6DA]">
        <Link to={backTo} className="text-sm text-[#D96B00] hover:underline shrink-0">
          ← {backLabel}
        </Link>
        <span className="w-px h-6 bg-[#EFE6DA] hidden sm:block" />
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <ClientAvatar name={other?.name} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#2B221E] truncate">{other?.name}</p>
            <p className="text-xs text-[#8A7A6D] truncate">
              {format(parseISO(session.date), "EEE, MMM d")} · {session.startTime}–{session.endTime} ·{" "}
              <span className="text-[#D96B00] font-medium">{statusLine(session, now)}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-[#F3EBDF]/70 rounded-full">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => toggle(t.key)}
              aria-pressed={panel === t.key}
              className={`relative text-sm font-medium px-3.5 py-1.5 rounded-full transition ${
                panel === t.key ? "bg-[#211A16] text-white" : "text-[#6B5B52] hover:text-[#2B221E]"
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[#FF9E4C] text-[#211A16] text-[10px] font-bold flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 sm:p-4">
        <div className={`min-h-[280px] ${panel ? "flex-1 lg:flex-[1.5]" : "flex-1"}`}>
          <VideoStage join={join} displayName={displayName} />
        </div>

        {/* Both panels stay mounted so an unsaved note or a half-typed message survives tab switches */}
        <aside
          className={`flex-1 lg:flex-none ${notesPanel ? "lg:w-[400px]" : "lg:w-[360px]"} min-h-[260px] bg-[#FFFDF9] rounded-3xl border border-[#EFE6DA] overflow-hidden flex-col ${
            panel ? "flex" : "hidden"
          }`}
        >
          <div className="px-4 py-3 border-b border-[#F0E8DD]">
            {panel === "notes" ? (
              <>
                <p className="text-sm font-semibold text-[#2B221E]">Session notes</p>
                <p className="text-[11px] text-[#A89C8F]">🔐 Only you can see these · autosaves</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#2B221E]">Session chat</p>
                <p className="text-[11px] text-[#A89C8F]">Saved to your conversation with {other?.name}</p>
              </>
            )}
          </div>
          <div className={`flex-1 min-h-0 ${panel === "chat" ? "" : "hidden"}`}>
            <ChatThread
              compact
              messages={conversation.messages}
              hasMore={conversation.hasMore}
              onLoadMore={conversation.loadMore}
              loading={conversation.loading}
              me={me}
              otherName={other?.name || ""}
              onSend={conversation.sendText}
        otherTyping={conversation.otherTyping}
        onTyping={conversation.notifyTyping}
              emptyHint="Share a link or a quick note here during the session."
            />
          </div>
          {notesPanel && <div className={`flex-1 min-h-0 ${panel === "notes" ? "" : "hidden"}`}>{notesPanel}</div>}
        </aside>
      </div>
    </div>
  );
};

export default SessionRoom;
