import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { getClients } from "../../api/clientApi";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { useEntitlement } from "../../context/entitlementContext";

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const statusStyles = {
  active: "bg-[#EEF3F0] text-[#4F7161]",
  inactive: "bg-[#F3EFEA] text-[#8A7A6D]",
  archived: "bg-[#ECE7E1] text-[#6B5B52]",
};

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const { feature, refresh } = useEntitlement();
  const cap = feature("clients.active");

  // Client count may have changed since login (new bookings, archiving)
  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await getClients(params);
      setClients(res.data.clients);
    } catch (err) {
      console.error("Failed to load clients:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadClients(), 300); // debounce search
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const sortedClients = [...clients].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "sessions") return b.totalSessions - a.totalSessions;
    return new Date(b.createdAt) - new Date(a.createdAt); // recent (default)
  });

  return (
    <DashboardLayout>
      <div className="p-6 sm:p-8 max-w-5xl mx-auto" style={{ fontFamily: "Inter, sans-serif" }}>
        <div className="mb-6">
          <h1 className="text-2xl text-[#2B221E]" style={{ fontFamily: "Literata, serif" }}>
            Clients
          </h1>
          <p className="text-[#6B5B52] text-sm mt-1">
            {clients.length} {clients.length === 1 ? "client" : "clients"} total
          </p>
        </div>

        {cap && cap.limit !== null && cap.limit !== undefined && (
          <div className="flex flex-wrap items-center gap-4 bg-white border border-[#EFE6DA] rounded-2xl px-5 py-3.5 mb-6">
            <div className="flex-1 min-w-[180px]">
              <div className="flex justify-between text-xs text-[#6B5B52] mb-1.5">
                <span>Active clients on your {cap.tier?.name} plan</span>
                <span className="font-semibold tabular-nums">
                  {cap.usage} / {cap.limit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#F3EBDF] overflow-hidden">
                <div
                  className={`h-full rounded-full ${cap.usage >= cap.limit ? "bg-[#C8553D]" : "bg-[#FF9E4C]"}`}
                  style={{ width: `${Math.min((cap.usage / cap.limit) * 100, 100)}%` }}
                />
              </div>
            </div>
            {cap.usage >= cap.limit && (
              <Link to="/therapist/plans" className="text-sm font-semibold text-[#D96B00] hover:underline">
                At your limit — upgrade →
              </Link>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89C8F]">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-white border border-[#E5DCD3] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#E5DCD3] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white border border-[#E5DCD3] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40"
          >
            <option value="recent">Sort: Most recent</option>
            <option value="name">Sort: Name (A-Z)</option>
            <option value="sessions">Sort: Most sessions</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#E5DCD3] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-10 flex justify-center">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#D96B00]" />
            </div>
          ) : sortedClients.length === 0 ? (
            <div className="p-10 text-center text-[#6B5B52] text-sm">
              {statusFilter === "archived"
                ? "No archived clients."
                : search || statusFilter
                  ? "No clients match your filters."
                  : "No clients yet."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0E8DD] text-left text-xs text-[#A89C8F] uppercase tracking-wide">
                  <th className="px-5 py-3.5 font-medium">Client</th>
                  <th className="px-5 py-3.5 font-medium hidden sm:table-cell">Last Session</th>
                  <th className="px-5 py-3.5 font-medium hidden md:table-cell">Sessions</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 font-medium hidden lg:table-cell">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F0E8]">
                {sortedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-[#FBF8F3] transition">
                    <td className="px-5 py-3.5">
                      <Link to={`/therapist/clients/${client.id}`} className="flex items-center gap-3 group">
                        <div
                          className="w-9 h-9 shrink-0 rounded-full bg-[#FFE3C2] flex items-center justify-center text-[#D96B00] text-sm font-semibold"
                          style={{ fontFamily: "Literata, serif" }}
                        >
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#2B221E] group-hover:text-[#D96B00] transition truncate">
                            {client.name}
                          </p>
                          <p className="text-xs text-[#A89C8F] truncate">{client.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-[#6B5B52] hidden sm:table-cell">
                      {client.lastSessionDate
                        ? format(parseISO(client.lastSessionDate.slice(0, 10)), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[#6B5B52] hidden md:table-cell">
                      {client.totalSessions}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[client.archivedAt ? "archived" : client.status]}`}>
                        {client.archivedAt ? "archived" : client.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <div className="flex gap-1.5 flex-wrap">
                        {client.tags.length > 0 ? (
                          client.tags.map((tag, i) => (
                            <span key={i} className="text-xs bg-[#F3EEE6] text-[#6B5B52] px-2 py-0.5 rounded-full">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#A89C8F]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Clients;