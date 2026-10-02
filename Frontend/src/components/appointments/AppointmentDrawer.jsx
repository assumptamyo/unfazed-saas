import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import ClientAvatar from "./ClientAvatar";
import { getAppointmentById } from "../../api/appointmentApi";
import {
  PHASE_META,
  STATUS_META,
  formatTime,
  formatShortDate,
  durationMinutes,
  countdownLabel,
  relativeDayLabel,
} from "./appointmentUtils";

const MiniStat = ({ label, value }) => (
  <div className="flex-1 rounded-2xl bg-[#FBF8F3] border border-[#F0E8DD] px-3 py-2.5 text-center">
    <p className="font-serif text-xl text-[#2B221E]">{value ?? "–"}</p>
    <p className="text-[11px] text-[#A89C8F]">{label}</p>
  </div>
);

const buildTimeline = (a) => {
  const events = [{ label: "Booked", detail: format(parseISO(a.createdAt), "MMM d, yyyy · h:mm a"), color: "#D96B00" }];

  a.rescheduleHistory?.forEach((h, i) => {
    const next = a.rescheduleHistory[i + 1] || a;
    events.push({
      label: "Rescheduled",
      detail: `${formatShortDate(h.date)} ${formatTime(h.startTime)} → ${formatShortDate(next.date)} ${formatTime(next.startTime)}`,
      color: "#5B7A99",
    });
  });

  if (a.status === "cancelled" && a.cancellation) {
    events.push({
      label: "Cancelled",
      detail: a.cancellation.reason ? `“${a.cancellation.reason}”` : format(parseISO(a.cancellation.cancelledAt), "MMM d, yyyy"),
      color: "#9C3B2E",
    });
  } else if (a.status === "completed" || a.status === "no-show") {
    events.push({
      label: STATUS_META[a.status].label,
      detail: a.statusUpdatedAt ? format(parseISO(a.statusUpdatedAt), "MMM d, yyyy") : "",
      color: STATUS_META[a.status].color,
    });
  }
  return events;
};

const AppointmentDrawer = ({ appointment: a, now, onClose, onStatus, onReschedule, onCancel, busy }) => {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let alive = true;
    getAppointmentById(a.id)
      .then((res) => alive && setDetail(res.data))
      .catch(() => alive && setDetail({ failed: true }));
    return () => {
      alive = false;
    };
  }, [a.id, a.status]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const meta = PHASE_META[a.phase];
  const date = parseISO(a.date);
  const relative = relativeDayLabel(a.date);
  const stats = detail?.clientStats;
  const concern = detail?.appointment?.client?.presentingConcern;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#211A16]/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Appointment details"
        className="relative w-full sm:max-w-md h-full bg-[#FFFDF9] shadow-[-20px_0_60px_rgba(33,26,22,0.18)] flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div
          className="relative overflow-hidden px-6 pt-5 pb-6"
          style={{ background: `linear-gradient(160deg, ${meta.soft} 0%, #FFFDF9 85%)` }}
        >
          <div
            className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-40 blur-3xl"
            style={{ backgroundColor: meta.color }}
          />
          <div className="relative flex items-center justify-between mb-5">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "white", color: meta.color }}
            >
              {a.phase === "past" || a.phase === "cancelled" ? STATUS_META[a.status].label : meta.label}
            </span>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/70 text-[#6B5B52] hover:bg-white hover:text-[#2B221E] transition flex items-center justify-center"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="relative flex items-center gap-4">
            <ClientAvatar name={a.client?.name} size="lg" />
            <div className="min-w-0">
              <h2 className="font-serif text-2xl text-[#2B221E] leading-tight truncate">{a.client?.name}</h2>
              <p className="text-sm text-[#6B5B52] truncate">{a.client?.email}</p>
              {a.client?.phone && <p className="text-sm text-[#8A7A6D]">{a.client.phone}</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin px-6 pb-6 space-y-6">
          {/* When */}
          <div className="flex items-stretch gap-4 p-4 rounded-3xl bg-white border border-[#EFE6DA]">
            <div className="w-16 shrink-0 rounded-2xl bg-[#211A16] text-white flex flex-col items-center justify-center py-2">
              <span className="text-[10px] uppercase tracking-widest text-[#FFB877]">{format(date, "MMM")}</span>
              <span className="font-serif text-3xl leading-none my-0.5">{format(date, "d")}</span>
              <span className="text-[10px] text-white/60">{format(date, "EEE")}</span>
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <p className="text-[#2B221E] font-medium">
                {relative ? `${relative}, ` : ""}
                {format(date, "EEEE")}
              </p>
              <p className={`text-lg tabular-nums ${a.phase === "cancelled" ? "line-through text-[#A89C8F]" : "text-[#2B221E]"}`}>
                {formatTime(a.startTime)} – {formatTime(a.endTime)}
              </p>
              <p className="text-xs text-[#8A7A6D] mt-0.5">
                {durationMinutes(a)} min · <span className="capitalize">{a.sessionType}</span>
                {a.phase === "upcoming" && (
                  <span className="text-[#D96B00] font-medium"> · {countdownLabel(a, now)}</span>
                )}
              </p>
            </div>
          </div>

          {/* Client snapshot */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A89C8F]">Client snapshot</h3>
              {a.client?.id && (
                <Link to={`/therapist/clients/${a.client.id}`} className="text-xs font-medium text-[#D96B00] hover:underline">
                  Full profile →
                </Link>
              )}
            </div>
            {!detail ? (
              <div className="flex gap-2">
                <div className="skeleton flex-1 h-16 rounded-2xl" />
                <div className="skeleton flex-1 h-16 rounded-2xl" />
                <div className="skeleton flex-1 h-16 rounded-2xl" />
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <MiniStat label="Sessions" value={stats?.total} />
                  <MiniStat label="Completed" value={stats?.completed} />
                  <MiniStat label="No-shows" value={stats?.noShows} />
                </div>
                {concern && (
                  <div className="mt-3 rounded-2xl bg-[#FFF8F0] border border-[#FFE3C2] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D96B00]/80 mb-1">
                      What brings them in
                    </p>
                    <p className="text-sm text-[#4A413A] leading-relaxed">{concern}</p>
                  </div>
                )}
                {a.client?.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {a.client.tags.map((t) => (
                      <span key={t} className="text-xs bg-[#F3EEE6] text-[#6B5B52] px-2.5 py-1 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* History */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A89C8F] mb-3">History</h3>
            <ol className="relative border-l border-[#EAE0D4] ml-1.5 space-y-4">
              {buildTimeline(a).map((e, i) => (
                <li key={i} className="pl-5 relative">
                  <span
                    className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-[#FFFDF9]"
                    style={{ backgroundColor: e.color }}
                  />
                  <p className="text-sm font-medium text-[#2B221E]">{e.label}</p>
                  {e.detail && <p className="text-xs text-[#8A7A6D] mt-0.5">{e.detail}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Actions */}
        <div className="border-t border-[#F0E8DD] px-6 py-4 bg-white/80 backdrop-blur">
          {a.phase === "upcoming" && (
            <div className="flex gap-2">
              <button
                onClick={() => onReschedule(a)}
                className="flex-1 py-3 rounded-full text-sm font-semibold bg-[#211A16] text-white hover:bg-[#3A2E27] transition"
              >
                Reschedule
              </button>
              <button
                onClick={() => onCancel(a)}
                className="flex-1 py-3 rounded-full text-sm font-semibold border border-[#F5C2BE] text-[#9C3B2E] hover:bg-[#FDECEA] transition"
              >
                Cancel session
              </button>
            </div>
          )}

          {a.phase === "attention" && (
            <div className="space-y-2">
              <p className="text-xs text-[#8A7A6D] text-center mb-1">How did this session go?</p>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => onStatus(a, "completed")}
                  className="flex-1 py-3 rounded-full text-sm font-semibold bg-[#4F7161] text-white hover:bg-[#3F5C4F] transition disabled:opacity-50"
                >
                  ✓ Completed
                </button>
                <button
                  disabled={busy}
                  onClick={() => onStatus(a, "no-show")}
                  className="flex-1 py-3 rounded-full text-sm font-semibold bg-[#F7EEF3] text-[#8A5C77] hover:bg-[#EEDCE6] transition disabled:opacity-50"
                >
                  No-show
                </button>
              </div>
              <div className="flex justify-center gap-4 pt-1">
                <button onClick={() => onReschedule(a)} className="text-xs font-medium text-[#6B5B52] hover:text-[#D96B00]">
                  Reschedule instead
                </button>
                <button onClick={() => onCancel(a)} className="text-xs font-medium text-[#6B5B52] hover:text-[#9C3B2E]">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {a.phase === "past" && (
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => onStatus(a, a.status === "completed" ? "no-show" : "completed")}
                className="flex-1 py-3 rounded-full text-sm font-semibold border border-[#EFE6DA] text-[#2B221E] hover:border-[#FF9E4C] transition disabled:opacity-50"
              >
                Mark as {a.status === "completed" ? "no-show" : "completed"}
              </button>
              <button
                disabled={busy}
                onClick={() => onStatus(a, "confirmed")}
                className="py-3 px-5 rounded-full text-sm font-medium text-[#6B5B52] hover:bg-[#F3EBDF] transition disabled:opacity-50"
              >
                Undo
              </button>
            </div>
          )}

          {a.phase === "cancelled" && (
            <p className="text-xs text-center text-[#A89C8F]">
              Cancelled sessions are kept for your records and can't be changed.
            </p>
          )}

          {detail?.failed && (
            <p className="text-xs text-center text-[#9C3B2E] mt-2">Couldn't load client details.</p>
          )}
        </div>
      </aside>
    </div>
  );
};

export default AppointmentDrawer;
