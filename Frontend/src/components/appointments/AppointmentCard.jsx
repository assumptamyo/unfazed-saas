import ClientAvatar from "./ClientAvatar";
import {
  PHASE_META,
  STATUS_META,
  formatTime,
  durationMinutes,
  startDateTime,
  endDateTime,
} from "./appointmentUtils";

const RescheduleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const CancelIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const IconButton = ({ label, onClick, children, tone = "default" }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title={label}
    aria-label={label}
    className={`w-9 h-9 rounded-xl flex items-center justify-center border transition ${
      tone === "danger"
        ? "border-transparent text-[#9C3B2E]/70 hover:bg-[#FDECEA] hover:text-[#9C3B2E]"
        : "border-transparent text-[#8A7A6D] hover:bg-[#FFF3E6] hover:text-[#D96B00]"
    }`}
  >
    {children}
  </button>
);

const AppointmentCard = ({ appointment: a, now, onOpen, onStatus, onReschedule, onCancel, busy }) => {
  const meta = PHASE_META[a.phase];
  const isLive = a.phase === "upcoming" && now >= startDateTime(a) && now < endDateTime(a);
  const wasRescheduled = a.rescheduleHistory?.length > 0;

  return (
    <div className="group relative flex gap-2.5 sm:gap-4 animate-fade-up">
      {/* Time column */}
      <div className="hidden sm:block w-20 shrink-0 pt-4 text-right">
        <p className={`text-sm font-semibold tabular-nums ${a.phase === "cancelled" ? "text-[#C4B8AC] line-through" : "text-[#2B221E]"}`}>
          {formatTime(a.startTime)}
        </p>
        <p className="text-[11px] text-[#A89C8F] mt-0.5">{durationMinutes(a)} min</p>
      </div>

      {/* Timeline node */}
      <div className="relative shrink-0 flex flex-col items-center">
        <span className="absolute top-0 bottom-0 w-px bg-[#EAE0D4] group-last:bottom-auto group-last:h-6" />
        <span
          className={`mt-[1.15rem] w-3 h-3 rounded-full border-2 border-[#F9F6F0] z-10 ${isLive ? "animate-pulse-ring" : ""}`}
          style={{ backgroundColor: meta.color, boxShadow: isLive ? undefined : `0 0 0 3px ${meta.soft}` }}
        />
      </div>

      {/* Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(a)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(a))}
        className={`flex-1 min-w-0 mb-3 rounded-2xl border bg-white px-3.5 sm:px-4 py-3.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(217,107,0,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9E4C] ${
          a.phase === "cancelled" ? "opacity-70" : ""
        } ${isLive ? "border-[#FFD9AE] bg-gradient-to-r from-[#FFF8F0] to-white" : "border-[#EFE6DA] hover:border-[#FFD9AE]"}`}
      >
        <div className="flex items-center gap-3">
          <ClientAvatar name={a.client?.name} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-[#2B221E] truncate">{a.client?.name || "Unknown client"}</p>
              {isLive && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white bg-[#D96B00] px-2 py-0.5 rounded-full">
                  Live
                </span>
              )}
              {wasRescheduled && a.phase !== "cancelled" && (
                <span className="text-[10px] font-medium text-[#5B7A99] bg-[#EEF3F8] px-2 py-0.5 rounded-full whitespace-nowrap">
                  ↻ Rescheduled
                </span>
              )}
            </div>
            <p className="text-xs text-[#A89C8F] truncate mt-0.5">
              {formatTime(a.startTime)} – {formatTime(a.endTime)} · {a.client?.email}
            </p>
          </div>

          {/* Right side: actions depend on phase */}
          {a.phase === "upcoming" && (
            <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <IconButton label="Reschedule" onClick={() => onReschedule(a)}>
                <RescheduleIcon />
              </IconButton>
              <IconButton label="Cancel" tone="danger" onClick={() => onCancel(a)}>
                <CancelIcon />
              </IconButton>
            </div>
          )}

          {a.phase === "attention" && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatus(a, "completed");
                }}
                className="text-xs font-semibold px-3 py-2 rounded-xl bg-[#EEF3F0] text-[#4F7161] hover:bg-[#4F7161] hover:text-white transition disabled:opacity-50"
              >
                ✓ Completed
              </button>
              <button
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatus(a, "no-show");
                }}
                className="text-xs font-semibold px-3 py-2 rounded-xl bg-[#F7EEF3] text-[#8A5C77] hover:bg-[#8A5C77] hover:text-white transition disabled:opacity-50"
              >
                No-show
              </button>
            </div>
          )}

          {(a.phase === "past" || a.phase === "cancelled") && (
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
              style={{ backgroundColor: STATUS_META[a.status].soft, color: STATUS_META[a.status].color }}
            >
              {STATUS_META[a.status].label}
            </span>
          )}
        </div>

        {/* Mobile outcome buttons */}
        {a.phase === "attention" && (
          <div className="flex sm:hidden gap-2 mt-3">
            <button
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onStatus(a, "completed");
              }}
              className="flex-1 text-xs font-semibold py-2 rounded-xl bg-[#EEF3F0] text-[#4F7161] disabled:opacity-50"
            >
              ✓ Completed
            </button>
            <button
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onStatus(a, "no-show");
              }}
              className="flex-1 text-xs font-semibold py-2 rounded-xl bg-[#F7EEF3] text-[#8A5C77] disabled:opacity-50"
            >
              No-show
            </button>
          </div>
        )}

        {a.phase === "cancelled" && a.cancellation?.reason && (
          <p className="text-xs text-[#9C3B2E]/80 mt-2.5 pl-14 italic truncate">“{a.cancellation.reason}”</p>
        )}
      </div>
    </div>
  );
};

export default AppointmentCard;
