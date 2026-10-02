import { format, parseISO, isSameMonth } from "date-fns";
import { KIND_META, shortTime, todayKey } from "./availabilityUtils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const cellStyles = {
  working: "bg-white border-[#EFE6DA] hover:border-[#8DB3A1]",
  off: "bg-[#F6F1EA] border-transparent hover:border-[#E5DCD3]",
  blocked: "border-[#F5C2BE] hover:border-[#C8553D]/60",
  custom: "bg-[#FFF8E6] border-[#F6DFA8] hover:border-[#B7791F]/60",
};

const DayCell = ({ day, month, onSelect }) => {
  const date = parseISO(day.date);
  const isPast = day.date < todayKey();
  const isToday = day.date === todayKey();
  const outside = !isSameMonth(date, month);
  const booked = day.sessions.length;

  return (
    <button
      type="button"
      disabled={isPast}
      onClick={() => onSelect(day)}
      className={`group relative min-h-[64px] sm:min-h-[96px] rounded-xl sm:rounded-2xl border p-1.5 sm:p-2.5 text-left flex flex-col transition-all duration-200 ${cellStyles[day.kind]} ${
        isPast ? "opacity-40 cursor-default" : "hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(33,26,22,0.08)] cursor-pointer"
      } ${outside ? "opacity-45" : ""} ${isToday ? "ring-2 ring-[#FF9E4C] ring-offset-2 ring-offset-[#F9F6F0]" : ""}`}
      style={
        day.kind === "blocked"
          ? { backgroundImage: "repeating-linear-gradient(135deg, #FDECEA 0 8px, #FBE3DF 8px 16px)" }
          : undefined
      }
      aria-label={`${format(date, "EEEE, MMMM d")}: ${KIND_META[day.kind].label}${booked ? `, ${booked} booked` : ""}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`text-xs sm:text-sm tabular-nums leading-none ${
            isToday ? "font-bold text-[#D96B00]" : day.kind === "off" ? "text-[#A89C8F]" : "font-semibold text-[#2B221E]"
          }`}
        >
          {format(date, "d")}
        </span>
        {!isPast && (
          <span className="hidden sm:flex w-5 h-5 rounded-full bg-[#211A16] text-white text-xs items-center justify-center opacity-0 group-hover:opacity-100 transition">
            +
          </span>
        )}
      </div>

      {/* Desktop details */}
      <div className="hidden sm:flex flex-col gap-1 mt-auto">
        {day.kind === "working" && day.hours && (
          <span className="text-[11px] text-[#4F7161]">
            {shortTime(day.hours.start)}–{shortTime(day.hours.end)}
          </span>
        )}
        {day.kind === "custom" && day.hours && (
          <span className="text-[11px] font-medium text-[#B7791F] truncate">
            ◐ {shortTime(day.hours.start)}–{shortTime(day.hours.end)}
          </span>
        )}
        {day.kind === "blocked" && (
          <span className="text-[11px] font-medium text-[#9C3B2E] truncate">☾ {day.override?.reason || "Time off"}</span>
        )}
        {day.kind === "off" && <span className="text-[11px] text-[#C4B8AC]">Off</span>}
        {booked > 0 && (
          <span
            className={`self-start text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
              day.kind === "blocked" || day.kind === "off" ? "bg-[#C8553D] text-white" : "bg-[#FF9E4C]/20 text-[#D96B00]"
            }`}
            title={day.sessions.map((s) => `${s.startTime} ${s.clientName}`).join("\n")}
          >
            {booked} booked
          </span>
        )}
      </div>

      {/* Mobile: just dots */}
      <div className="flex sm:hidden gap-0.5 mt-auto">
        {day.kind !== "off" && (
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: KIND_META[day.kind].color }} />
        )}
        {booked > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#FF9E4C]" />}
      </div>
    </button>
  );
};

const AvailabilityCalendar = ({ month, days, onPrev, onNext, onToday, onSelect, loading }) => (
  <div className="bg-white/70 border border-[#EFE6DA] rounded-3xl p-3 sm:p-5">
    <div className="flex items-center justify-between gap-3 mb-4 px-1">
      <h2 className="font-serif text-xl sm:text-2xl text-[#2B221E]">{format(month, "MMMM yyyy")}</h2>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToday}
          className="h-9 px-3 rounded-xl text-sm font-medium text-[#6B5B52] border border-[#E5DCD3] bg-white hover:border-[#FF9E4C] transition"
        >
          Today
        </button>
        <button
          onClick={onPrev}
          aria-label="Previous month"
          className="w-9 h-9 rounded-xl text-[#6B5B52] border border-[#E5DCD3] bg-white hover:border-[#FF9E4C] transition"
        >
          ‹
        </button>
        <button
          onClick={onNext}
          aria-label="Next month"
          className="w-9 h-9 rounded-xl text-[#6B5B52] border border-[#E5DCD3] bg-white hover:border-[#FF9E4C] transition"
        >
          ›
        </button>
      </div>
    </div>

    <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1.5">
      {WEEKDAYS.map((d) => (
        <span key={d} className="text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#A89C8F]">
          {d}
        </span>
      ))}
    </div>

    <div className={`grid grid-cols-7 gap-1 sm:gap-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
      {days.length === 0
        ? Array.from({ length: 35 }, (_, i) => <div key={i} className="skeleton min-h-[64px] sm:min-h-[96px] rounded-2xl" />)
        : days.map((day) => <DayCell key={day.date} day={day} month={month} onSelect={onSelect} />)}
    </div>

    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 px-1 text-xs text-[#8A7A6D]">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-white border border-[#EFE6DA]" /> Working
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-[#F6F1EA]" /> Day off
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-3 h-3 rounded border border-[#F5C2BE]"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, #FDECEA 0 3px, #F5C2BE 3px 5px)" }}
        />
        Time off
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-[#FFF8E6] border border-[#F6DFA8]" /> Special hours
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#FF9E4C]" /> Booked sessions
      </span>
    </div>
  </div>
);

export default AvailabilityCalendar;
