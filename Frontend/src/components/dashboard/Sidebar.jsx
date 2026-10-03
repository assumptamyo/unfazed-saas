import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  clients: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  schedule: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  appointments: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
    </svg>
  ),
  messages: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  notes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  billing: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  analytics: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  plans: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const NavItem = ({ icon, label, to, active, soon }) => {
  const base = "relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 group";
  const activeStyle = "bg-[#FF9E4C]/15 text-[#D96B00] font-semibold shadow-2xs";
  const idleStyle = "text-[#6B5B52] hover:bg-[#EFE6DA]/50 hover:text-[#2B221E]";

  if (soon) {
    return (
      <div className={`${base} ${idleStyle} opacity-50 cursor-default justify-between`}>
        <span className="flex items-center gap-3">
          <span className="text-[#6B5B52] group-hover:scale-110 transition-transform">{icon}</span>
          {label}
        </span>
        <span className="text-[10px] bg-[#E5DCD3] text-[#6B5B52] px-2 py-0.5 rounded-full font-sans tracking-wide">Soon</span>
      </div>
    );
  }

  return (
    <Link to={to} className={`${base} ${active ? activeStyle : idleStyle}`}>
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#D96B00] rounded-r-full" />
      )}
      <span className={`${active ? "text-[#D96B00]" : "text-[#6B5B52] group-hover:text-[#2B221E]"} transition-colors`}>
        {icon}
      </span>
      {label}
    </Link>
  );
};

const Sidebar = ({ open, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const path = location.pathname;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isClientsActive = path === "/therapist/clients" || path.startsWith("/therapist/clients/");

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs z-30 md:hidden transition-opacity" onClick={onClose} />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 h-full md:h-screen w-72 shrink-0 bg-[#FBF8F3] border-r border-[#E5DCD3] flex flex-col p-6 z-40 transition-transform duration-300 shadow-sm md:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        {/* Brand / Logo Header */}
        <div className="mb-8 px-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF9E4C] to-[#D96B00] flex items-center justify-center text-white text-base font-bold shadow-sm">
              U
            </div>
            <div>
              <span className="text-xl font-semibold text-[#2B221E] tracking-tight" style={{ fontFamily: "Literata, serif" }}>
                Unfazed
              </span>
              <p className="text-[11px] text-[#6B5B52] font-medium tracking-wide">Therapist Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 space-y-6 overflow-y-auto pr-1">

          {/* Main Practice Section */}
          <div>
            <p className="px-4 text-[10px] font-semibold text-[#6B5B52] uppercase tracking-wider mb-2">
              Practice
            </p>
            <div className="space-y-1">
              <NavItem
                icon={icons.dashboard}
                label="Dashboard"
                to="/therapist/dashboard"
                active={path === "/therapist/dashboard"}
              />
              <NavItem
                icon={icons.appointments}
                label="Appointments"
                to="/therapist/appointments"
                active={path === "/therapist/appointments"}
              />
              <NavItem
                icon={icons.schedule}
                label="Availability"
                to="/therapist/schedule"
                active={path === "/therapist/schedule"}
              />
              <NavItem
                icon={icons.clients}
                label="Clients CRM"
                to="/therapist/clients"
                active={isClientsActive}
              />
              <NavItem
                icon={icons.messages}
                label="Messages"
                to="/therapist/messages"
                active={path.startsWith("/therapist/messages")}
              />
              <NavItem
                icon={icons.notes}
                label="Session Notes"
                to="/therapist/notes"
                active={path.startsWith("/therapist/notes")}
              />
            </div>
          </div>

          {/* Management & System Section */}
          <div>
            <p className="px-4 text-[10px] font-semibold text-[#6B5B52] uppercase tracking-wider mb-2">
              Management
            </p>
            <div className="space-y-1">
              <NavItem
                icon={icons.billing}
                label="Billing & Payments"
                to="/therapist/billing"
                active={path === "/therapist/billing"}
              />
              <NavItem
                icon={icons.analytics}
                label="Analytics & Reports"
                to="/therapist/analytics"
                active={path === "/therapist/analytics"}
              />
              <NavItem
                icon={icons.plans}
                label="Plans"
                to="/therapist/plans"
                active={path === "/therapist/plans"}
              />
              <NavItem
                icon={icons.settings}
                label="Profile & Settings"
                to="/therapist/profile"
                active={path === "/therapist/profile"}
              />
            </div>
          </div>

        </nav>

        {/* Logout Footer Button */}
        <div className="pt-4 border-t border-[#E5DCD3]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors group"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-0.5 transition-transform">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Log out</span>
          </button>
        </div>

      </aside>
    </>
  );
};

export default Sidebar;