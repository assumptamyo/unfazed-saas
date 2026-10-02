import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";

const statusDot = {
  active: "bg-[#4F7161]",
  inactive: "bg-[#A89C8F]",
};

const ClientQuickOverview = ({ clients = [] }) => {
  if (clients.length === 0) {
    return (
      <div className="bg-white border border-[#E5DCD3] rounded-3xl p-8 text-center" style={{ fontFamily: "Inter, sans-serif" }}>
        <p className="text-[#6B5B52] text-sm">
          No clients yet. Once someone books a session, they'll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5DCD3] rounded-3xl p-6" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[#2B221E] text-lg" style={{ fontFamily: "Literata, serif" }}>
          Client Overview
        </h3>
        <Link
          to="/therapist/clients"
          className="text-xs text-[#D96B00] font-medium hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-1">
        {clients.map((client) => (
          <div
            key={client.id}
            className="flex items-center justify-between gap-3 py-2.5 px-2 rounded-xl hover:bg-[#FBF8F3] transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div
                  className="w-9 h-9 rounded-full bg-[#FFE3C2] flex items-center justify-center text-[#D96B00] text-sm font-semibold"
                  style={{ fontFamily: "Literata, serif" }}
                >
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${statusDot[client.status]}`}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#2B221E] truncate">{client.name}</p>
                <p className="text-xs text-[#A89C8F] truncate">{client.email}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-xs text-[#A89C8F]">
                Joined {format(parseISO(client.createdAt), "MMM d")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientQuickOverview;