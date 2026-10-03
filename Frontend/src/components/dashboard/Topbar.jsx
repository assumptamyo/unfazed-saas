import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocketEvents } from "../../hooks/useSocket";
import { getUnreadCount } from "../../api/messagesApi";
import ProfileMenu from "./ProfileMenu";
import NotificationBell from "./NotificationBell";

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const Topbar = ({ therapist, searchValue, onSearchChange, onMenuClick }) => {
  const { token } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    getUnreadCount()
      .then((res) => alive && setUnread(res.data.count))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useSocketEvents(token, {
    "message:new": (m) => m.sender === "client" && setUnread((n) => n + 1),
    "messages:read": ({ reader }) =>
      reader === "therapist" && getUnreadCount().then((res) => setUnread(res.data.count)).catch(() => {}),
  });

  return (
    <header
      className="bg-white/85 backdrop-blur-md border-b border-[#E5DCD3] px-6 sm:px-8 py-4 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-2xs"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* Left side: Mobile Menu + Search Bar */}
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={onMenuClick}
          className="md:hidden text-[#6B5B52] hover:text-[#2B221E] p-1 rounded-lg hover:bg-[#F9F6F0] transition"
          aria-label="Toggle Menu"
        >
          <MenuIcon />
        </button>

        <div className="relative max-w-sm w-full hidden sm:block">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A89C8F] pointer-events-none">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search clients, sessions..."
            className="bg-[#F9F6F0] border border-[#E5DCD3] rounded-2xl pl-11 pr-4 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition-all"
          />
        </div>
      </div>

      {/* Right side: Quick Actions, Notifications & Profile */}
      <div className="flex items-center gap-3 sm:gap-4">

        {/* Messages, with a live unread count */}
        <Link
          to="/therapist/messages"
          className="relative w-10 h-10 rounded-2xl bg-[#F9F6F0] border border-[#E5DCD3] flex items-center justify-center text-[#6B5B52] hover:border-[#FF9E4C] hover:text-[#D96B00] transition"
          aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
        >
          <ChatIcon />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-[#FF9E4C] text-[#211A16] text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>

        <NotificationBell />

        {/* Quick Add Schedule Button */}
        <Link
          to="/therapist/schedule"
          className="w-10 h-10 rounded-2xl bg-[#FF9E4C] flex items-center justify-center text-white hover:bg-[#D96B00] transition-colors shadow-xs hover:shadow-md"
          aria-label="Add Schedule"
        >
          <PlusIcon />
        </Link>

        <ProfileMenu therapist={therapist} />

      </div>
    </header>
  );
};

export default Topbar;