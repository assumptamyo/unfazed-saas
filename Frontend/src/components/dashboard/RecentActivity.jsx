import { format, parseISO } from "date-fns";

const statusStyles = {
  confirmed: "bg-[#EAF6EC] text-[#2F6B3A]",
  cancelled: "bg-[#FDECEA] text-[#9C3B2E]",
  completed: "bg-[#E8EEF9] text-[#2F4D7A]",
  "no-show": "bg-[#FFF3E6] text-[#8A4B00]",
};

const RecentActivity = ({ sessions = [] }) => {
  if (sessions.length === 0) {
    return (
      <div className="bg-white border border-[#EFE6DA] rounded-2xl p-8 text-center">
        <p className="text-[#6B6059] text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
          No bookings yet. Once clients start booking, they'll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#EFE6DA] rounded-2xl p-6" style={{ fontFamily: "Inter, sans-serif" }}>
      <h3 className="text-[#2B221E] text-lg mb-4" style={{ fontFamily: "Literata, serif" }}>
        Recent activity
      </h3>
      <div className="divide-y divide-[#F3EBDF]">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between text-sm py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full bg-[#FFF3E6] text-[#D96B00] flex items-center justify-center text-sm font-medium"
                style={{ fontFamily: "Literata, serif" }}
              >
                {s.clientName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-[#2B221E] font-medium">{s.clientName}</p>
                <p className="text-[#A89C8F] text-xs">
                  {format(parseISO(s.date), "MMM d")} · {s.startTime}
                </p>
              </div>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusStyles[s.status]}`}>
              {s.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivity;