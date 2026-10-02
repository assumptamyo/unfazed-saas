import { addDays, format, isSameDay } from "date-fns";
import { PHASE_META, STATUS_META, toMinutes, formatTime } from "./appointmentUtils";

const HOUR_HEIGHT = 56;

const WeekBoard = ({ appointments, weekStart, now, onOpen }) => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayKeys = days.map((d) => format(d, "yyyy-MM-dd"));
  const inWeek = appointments.filter((a) => dayKeys.includes(a.date));

  // Fit the grid to the sessions, but always show at least 8am–6pm
  let startHour = 8;
  let endHour = 18;
  inWeek.forEach((a) => {
    startHour = Math.min(startHour, Math.floor(toMinutes(a.startTime) / 60));
    endHour = Math.max(endHour, Math.ceil(toMinutes(a.endTime) / 60));
  });
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine = nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;

  return (
    <div className="bg-white border border-[#EFE6DA] rounded-3xl overflow-hidden animate-fade-up">
      <div className="overflow-x-auto scroll-thin">
        <div className="min-w-[760px]">
          {/* Day headers */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[#F0E8DD] bg-[#FFFDF9]">
            <div />
            {days.map((d) => {
              const today = isSameDay(d, now);
              const count = inWeek.filter((a) => a.date === format(d, "yyyy-MM-dd") && a.status !== "cancelled").length;
              return (
                <div key={d.toISOString()} className="px-2 py-3 text-center border-l border-[#F6F0E8]">
                  <p className={`text-[11px] uppercase tracking-wider ${today ? "text-[#D96B00] font-semibold" : "text-[#A89C8F]"}`}>
                    {format(d, "EEE")}
                  </p>
                  <p
                    className={`font-serif text-xl mx-auto mt-0.5 w-9 h-9 flex items-center justify-center rounded-full ${
                      today ? "bg-[#FF9E4C] text-[#211A16]" : "text-[#2B221E]"
                    }`}
                  >
                    {format(d, "d")}
                  </p>
                  <p className="text-[10px] text-[#A89C8F] mt-0.5 h-3">{count > 0 ? `${count} session${count > 1 ? "s" : ""}` : ""}</p>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] relative" style={{ height: gridHeight }}>
            {/* Hour labels */}
            <div className="relative">
              {hours.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[10px] text-[#A89C8F] tabular-nums"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  {i === 0 ? "" : format(new Date(2000, 0, 1, h), "h a")}
                </span>
              ))}
            </div>

            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const today = isSameDay(d, now);
              const dayItems = inWeek.filter((a) => a.date === key);

              return (
                <div
                  key={key}
                  className={`relative border-l border-[#F6F0E8] ${today ? "bg-[#FFF8F0]/60" : ""}`}
                  style={{
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT - 1}px, #F6F0E8 ${HOUR_HEIGHT - 1}px, #F6F0E8 ${HOUR_HEIGHT}px)`,
                  }}
                >
                  {today && showNowLine && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{ top: ((nowMinutes - startHour * 60) / 60) * HOUR_HEIGHT }}
                    >
                      <div className="relative h-0.5 bg-[#D96B00]">
                        <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-[#D96B00]" />
                      </div>
                    </div>
                  )}

                  {dayItems.map((a) => {
                    const top = ((toMinutes(a.startTime) - startHour * 60) / 60) * HOUR_HEIGHT;
                    const height = Math.max(((toMinutes(a.endTime) - toMinutes(a.startTime)) / 60) * HOUR_HEIGHT - 3, 26);
                    const meta = a.phase === "past" ? STATUS_META[a.status] : PHASE_META[a.phase];
                    const cancelled = a.status === "cancelled";

                    return (
                      <button
                        key={a.id}
                        onClick={() => onOpen(a)}
                        className={`absolute left-1 right-1 rounded-xl px-2 py-1.5 text-left overflow-hidden border-l-[3px] transition hover:shadow-md hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9E4C] ${
                          cancelled ? "opacity-55" : ""
                        }`}
                        style={{
                          top,
                          height,
                          backgroundColor: meta.soft,
                          borderLeftColor: meta.color,
                          backgroundImage: cancelled
                            ? "repeating-linear-gradient(135deg, transparent 0 6px, rgba(156,59,46,0.07) 6px 12px)"
                            : undefined,
                        }}
                        title={`${a.client?.name} · ${formatTime(a.startTime)}–${formatTime(a.endTime)}`}
                      >
                        <p className={`text-xs font-semibold truncate ${cancelled ? "line-through" : ""}`} style={{ color: meta.color }}>
                          {a.client?.name}
                        </p>
                        {height > 36 && (
                          <p className="text-[10px] text-[#6B5B52] truncate">
                            {formatTime(a.startTime)} – {formatTime(a.endTime)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {inWeek.length === 0 && (
        <p className="text-center text-sm text-[#A89C8F] py-4 border-t border-[#F0E8DD]">
          Nothing booked this week.
        </p>
      )}
    </div>
  );
};

export default WeekBoard;
