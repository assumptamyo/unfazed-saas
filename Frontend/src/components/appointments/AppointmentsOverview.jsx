import { useState } from "react";
import ClientAvatar from "./ClientAvatar";
import { countdownLabel, formatTime, formatLongDate, relativeDayLabel, startDateTime } from "./appointmentUtils";

const NextUpCard = ({ next, now, slug, onOpen, onReschedule }) => {
  const [copied, setCopied] = useState(false);
  const bookingUrl = slug ? `${window.location.origin}/${slug}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable - ignore */
    }
  };

  const minutesAway = next ? (startDateTime(next) - now) / 60000 : null;
  const soon = minutesAway !== null && minutesAway <= 60;

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-[#211A16] text-white p-6 sm:p-7 min-h-[220px] flex flex-col">
      <div
        className="pointer-events-none absolute -top-28 -right-20 w-80 h-80 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, #FF9E4C 0%, #C9602E 45%, transparent 75%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 w-60 h-60 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #B98EA7 0%, transparent 70%)" }}
      />
      {/* Decorative oversized time */}
      {next && (
        <span className="pointer-events-none select-none absolute right-5 bottom-1 font-serif text-[88px] sm:text-[110px] leading-none text-white/[0.06] tabular-nums">
          {next.startTime}
        </span>
      )}

      <div className="relative flex items-center justify-between gap-3 mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFB877]">Next up</p>
        {next && (
          <span
            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full ${
              soon ? "bg-[#FF9E4C] text-[#211A16]" : "bg-white/10 text-white/80"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${soon ? "bg-[#211A16] animate-pulse" : "bg-[#FFB877]"}`} />
            {countdownLabel(next, now)}
          </span>
        )}
      </div>

      {next ? (
        <div className="relative flex-1 flex flex-col">
          <div className="flex items-center gap-4">
            <ClientAvatar name={next.client?.name} size="lg" className="ring-4 ring-white/10" />
            <div className="min-w-0">
              <h2 className="font-serif text-2xl sm:text-3xl leading-tight truncate">{next.client?.name}</h2>
              <p className="text-sm text-[#D8C9BC] mt-1">
                {relativeDayLabel(next.date) || formatLongDate(next.date)} · {formatTime(next.startTime)} – {formatTime(next.endTime)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-auto pt-6">
            <button
              onClick={() => onOpen(next)}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-white text-[#211A16] hover:bg-[#FFF3E6] transition"
            >
              View details
            </button>
            <button
              onClick={() => onReschedule(next)}
              className="px-5 py-2.5 rounded-full text-sm font-medium text-white/85 border border-white/15 hover:bg-white/10 transition"
            >
              Reschedule
            </button>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col">
          <h2 className="font-serif text-2xl sm:text-3xl leading-tight">Your calendar is clear.</h2>
          <p className="text-sm text-[#D8C9BC] mt-2 max-w-sm">
            Share your booking page so clients can pick a time that suits them.
          </p>
          {bookingUrl && (
            <div className="mt-auto pt-6 flex items-center gap-2 max-w-md">
              <span className="flex-1 min-w-0 truncate text-sm bg-white/10 border border-white/10 rounded-full px-4 py-2.5 text-white/80">
                {bookingUrl.replace(/^https?:\/\//, "")}
              </span>
              <button
                onClick={copyLink}
                className="shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Ring = ({ value }) => {
  const r = 16;
  const c = 2 * Math.PI * r;
  const pct = value ?? 0;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#F3EBDF" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={pct > 20 ? "#C8553D" : "#8A5C77"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
      />
    </svg>
  );
};

const Tile = ({ label, value, hint, accent, children }) => (
  <div className="relative overflow-hidden rounded-3xl bg-white border border-[#EFE6DA] p-4 flex flex-col justify-between min-h-[104px]">
    <span className="absolute top-0 left-4 right-4 h-[3px] rounded-b-full" style={{ backgroundColor: accent }} />
    <p className="text-xs text-[#8A7A6D] font-medium">{label}</p>
    <div className="flex items-end justify-between gap-2 mt-2">
      <div>
        <p className="font-serif text-3xl text-[#2B221E] leading-none">{value}</p>
        {hint && <p className="text-[11px] text-[#A89C8F] mt-1.5">{hint}</p>}
      </div>
      {children}
    </div>
  </div>
);

const AppointmentsOverview = ({ summary, now, slug, onOpen, onReschedule }) => (
  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 mb-8">
    <NextUpCard next={summary.nextSession} now={now} slug={slug} onOpen={onOpen} onReschedule={onReschedule} />
    <div className="grid grid-cols-2 gap-4">
      <Tile label="Today" value={summary.today} hint="sessions on the calendar" accent="#FF9E4C" />
      <Tile label="Next 7 days" value={summary.thisWeek} hint="confirmed & upcoming" accent="#D96B00" />
      <Tile label="Completed" value={summary.completedThisMonth} hint="this month" accent="#4F7161" />
      <Tile
        label="No-show rate"
        value={summary.noShowRate === null ? "–" : `${summary.noShowRate}%`}
        hint="last 90 days"
        accent="#8A5C77"
      >
        {summary.noShowRate !== null && <Ring value={summary.noShowRate} />}
      </Tile>
    </div>
  </div>
);

export default AppointmentsOverview;
