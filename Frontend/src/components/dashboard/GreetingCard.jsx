import { useState, useEffect } from "react";

const useLiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};

const getGreeting = (hour) => {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const StatChip = ({ label, value }) => (
  <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-4 py-3 flex-1 min-w-[110px]">
    <p className="text-2xl text-white" style={{ fontFamily: "Literata, serif", fontWeight: 560 }}>
      {value}
    </p>
    <p className="text-xs text-[#D8C9BC] mt-0.5">{label}</p>
  </div>
);

const GreetingCard = ({ therapist, stats }) => {
  const now = useLiveClock();
  const initial = therapist?.name?.charAt(0)?.toUpperCase() || "?";

  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8 mb-6"
      style={{ backgroundColor: "#211A16" }}
    >
      <div
        className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, #FF9E4C 0%, #C9602E 40%, transparent 75%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #FF9E4C 0%, transparent 70%)" }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-4">
            {therapist?.photoUrl ? (
              <img
                src={therapist.photoUrl}
                alt={therapist.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-[#FF9E4C] text-2xl"
                style={{ fontFamily: "Literata, serif" }}
              >
                {initial}
              </div>
            )}
            <div>
              <p className="text-[#D8C9BC] text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                {getGreeting(now.getHours())},
              </p>
              <h1 className="text-2xl sm:text-3xl text-white" style={{ fontFamily: "Literata, serif" }}>
                {therapist?.name}
              </h1>
            </div>
          </div>

          <div className="text-right" style={{ fontFamily: "Inter, sans-serif" }}>
            <p className="text-white text-xl font-medium tabular-nums">{timeStr}</p>
            <p className="text-[#D8C9BC] text-sm">{dateStr}</p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap" style={{ fontFamily: "Inter, sans-serif" }}>
          <StatChip label="Active Schedule Days" value={stats?.activeScheduleDays ?? 0} />
          <StatChip label="Total Patients" value={stats?.totalClients ?? 0} />
          <StatChip label="Upcoming Sessions" value={stats?.upcomingSessions ?? 0} />
          <StatChip label="This Week" value={stats?.sessionsThisWeek ?? 0} />
        </div>
      </div>
    </div>
  );
};

export default GreetingCard;