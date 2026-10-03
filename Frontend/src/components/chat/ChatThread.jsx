import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";

const dayLabel = (iso) => {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMMM d");
};

// A conversation with a composer. `me` is "therapist" or "client" and decides
// which side bubbles sit on. Sending is handled by the parent via onSend(text).
const ChatThread = ({
  messages,
  me,
  otherName,
  onSend,
  hasMore,
  onLoadMore,
  loading,
  disabledReason,
  compact = false,
  emptyHint,
  otherTyping = false,
  onTyping,
}) => {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const prev = useRef({ firstId: null, lastId: null, height: 0 });

  // New messages at the bottom: scroll down. Older messages loaded above: keep the reading position.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;
    const lastId = messages[messages.length - 1]?.id ?? null;
    const loadedOlder = prev.current.lastId === lastId && prev.current.firstId !== firstId && prev.current.firstId;
    el.scrollTop = loadedOlder ? el.scrollHeight - prev.current.height : el.scrollHeight;
    prev.current = { firstId, lastId, height: el.scrollHeight };
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    el.style.overflowY = el.scrollHeight > 140 ? "auto" : "hidden";
  }, [draft]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setDraft("");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  // Last message I sent that the other side has read
  const lastSeenId = [...messages].reverse().find((m) => m.sender === me && m.readAt)?.id;

  let lastDay = null;
  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className={`flex-1 min-h-0 overflow-y-auto scroll-thin ${compact ? "px-3 py-3" : "px-4 sm:px-6 py-5"}`}>
        {hasMore && (
          <div className="text-center mb-4">
            <button
              onClick={onLoadMore}
              className="text-xs font-medium text-[#8A7A6D] hover:text-[#D96B00] px-3 py-1.5 rounded-full border border-[#EFE6DA] bg-white"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {loading && messages.length === 0 ? (
          <div className="space-y-3">
            <div className="skeleton h-10 w-2/3 rounded-2xl" />
            <div className="skeleton h-10 w-1/2 rounded-2xl ml-auto" />
            <div className="skeleton h-10 w-3/5 rounded-2xl" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF3E6] text-[#D96B00] flex items-center justify-center text-xl mb-3">✉</div>
            <p className="text-sm text-[#6B5B52]">{emptyHint || `Start the conversation with ${otherName}.`}</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender === me;
            const day = dayLabel(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex items-center gap-3 my-4">
                    <span className="flex-1 h-px bg-[#EFE6DA]" />
                    <span className="text-[11px] font-medium text-[#A89C8F]">{day}</span>
                    <span className="flex-1 h-px bg-[#EFE6DA]" />
                  </div>
                )}
                <div className={`flex mb-2 ${mine ? "justify-end" : "justify-start"} animate-fade-in`}>
                  <div className={`max-w-[85%] sm:max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                    <div
                      className={`px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                        mine
                          ? "bg-[#211A16] text-white rounded-2xl rounded-br-md"
                          : "bg-white border border-[#EFE6DA] text-[#2B221E] rounded-2xl rounded-bl-md"
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[10px] text-[#A89C8F] mt-1 px-1">
                      {format(parseISO(m.createdAt), "h:mm a")}
                      {m.sessionId && " · in session"}
                      {m.id === lastSeenId && " · Seen"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {otherTyping && (
        <div className={`flex items-center gap-2 text-xs text-[#8A7A6D] ${compact ? "px-3 pb-1.5" : "px-6 pb-2"} animate-fade-in`} aria-live="polite">
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#C4B8AC] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
          {otherName} is typing…
        </div>
      )}

      <div className={`border-t border-[#F0E8DD] bg-white/80 backdrop-blur ${compact ? "p-2.5" : "p-3 sm:p-4"}`}>
        {disabledReason ? (
          <p className="text-xs text-center text-[#A89C8F] py-2">{disabledReason}</p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              maxLength={4000}
              onChange={(e) => {
                setDraft(e.target.value);
                onTyping?.();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={`Message ${otherName}…`}
              className="flex-1 resize-none bg-[#FBF8F3] border border-[#EFE6DA] rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition"
            />
            <button
              onClick={submit}
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              className="w-10 h-10 shrink-0 rounded-full bg-[#FF9E4C] text-[#211A16] flex items-center justify-center hover:bg-[#FFB877] transition disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        )}
        {!disabledReason && !compact && (
          <p className="text-[10px] text-[#C4B8AC] mt-1.5 px-2">Enter to send · Shift+Enter for a new line</p>
        )}
      </div>
    </div>
  );
};

export default ChatThread;
