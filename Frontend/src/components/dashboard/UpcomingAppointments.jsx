import { format, parseISO, isToday, isTomorrow, differenceInCalendarDays } from "date-fns";

const formatDayLabel = (dateStr) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
};

const urgencyStyle = (dateStr) => {
  const days = differenceInCalendarDays(parseISO(dateStr), new Date());
  if (days <= 0) return { bar: "#FF9E4C", chipBg: "#FFF3E6", chipText: "#D96B00" };
  if (days === 1) return { bar: "#B98EA7", chipBg: "#F7EEF3", chipText: "#8A5C77" };
  return { bar: "#6B9080", chipBg: "#EEF3F0", chipText: "#4F7161" };
};

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
  </svg>
);

const UpcomingAppointments = ({ appointments = [] }) => {
  if (appointments.length === 0) {
    return (
      <div
        className="relative overflow-hidden bg-white border border-[#E5DCD3] rounded-3xl p-8 text-center"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        <div
          className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 blur-2xl"
          style={{ background: "radial-gradient(circle, #FF9E4C 0%, transparent 70%)" }}
        />
        <p className="relative text-[#6B5B52] text-sm">
          No upcoming sessions yet. Once clients book, they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5DCD3] rounded-3xl p-6" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[#2B221E] text-lg" style={{ fontFamily: "Literata, serif" }}>
          Upcoming Sessions
        </h3>
        <span className="text-xs bg-gradient-to-r from-[#FF9E4C] to-[#D96B00] text-white px-3 py-1 rounded-full font-semibold shadow-sm">
          {appointments.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {appointments.map((appt) => {
          const { bar, chipBg, chipText } = urgencyStyle(appt.date);
          return (
            <div
              key={appt.id}
              className="group relative flex items-center gap-4 pl-5 pr-4 py-3.5 rounded-2xl bg-[#FBF8F3] hover:bg-white border border-transparent hover:border-[#E5DCD3] hover:shadow-sm transition-all overflow-hidden"
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ backgroundColor: bar }}
              />

              <div
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center font-semibold text-white"
                style={{
                  fontFamily: "Literata, serif",
                  background: `linear-gradient(135deg, ${bar}, ${bar}CC)`,
                }}
              >
                {appt.clientName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#2B221E] truncate">{appt.clientName}</p>
                <p className="text-xs text-[#A89C8F] truncate">{appt.clientEmail}</p>
              </div>

              <div className="text-right shrink-0">
                <span
                  className="inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-1"
                  style={{ backgroundColor: chipBg, color: chipText }}
                >
                  {formatDayLabel(appt.date)}
                </span>
                <p className="text-xs text-[#A89C8F] flex items-center justify-end gap-1">
                  <ClockIcon />
                  {appt.startTime}–{appt.endTime}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UpcomingAppointments;