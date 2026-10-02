import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

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

const Topbar = ({ therapist, recentActivity = [], searchValue, onSearchChange, onMenuClick }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChatTip, setShowChatTip] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = therapist?.name?.charAt(0)?.toUpperCase() || "?";
  const slugAddress = therapist?.slug ? `unfazed.in/${therapist.slug}` : "unfazed.in/profile";

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

        {/* Chat / Messages Tooltip Button */}
        <div className="relative">
          <button
            onMouseEnter={() => setShowChatTip(true)}
            onMouseLeave={() => setShowChatTip(false)}
            className="w-10 h-10 rounded-2xl bg-[#F9F6F0] border border-[#E5DCD3] flex items-center justify-center text-[#6B5B52] opacity-50 cursor-not-allowed transition"
            aria-label="Chat"
          >
            <ChatIcon />
          </button>
          {showChatTip && (
            <div className="absolute right-0 mt-2 bg-[#2B221E] text-white text-xs px-3 py-1.5 rounded-xl whitespace-nowrap shadow-md z-30">
              Chat — coming soon
            </div>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className="w-10 h-10 rounded-2xl bg-[#F9F6F0] border border-[#E5DCD3] flex items-center justify-center text-[#6B5B52] hover:border-[#FF9E4C] hover:text-[#D96B00] transition relative"
            aria-label="Notifications"
          >
            <BellIcon />
            {recentActivity.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF9E4C] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                {recentActivity.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white border border-[#E5DCD3] rounded-3xl shadow-xl py-3 z-30 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 pb-2 border-b border-[#E5DCD3] flex items-center justify-between">
                <p className="text-xs font-semibold text-[#6B5B52] uppercase tracking-wider">
                  Recent Bookings
                </p>
                <span className="text-[10px] bg-[#FF9E4C]/15 text-[#D96B00] px-2 py-0.5 rounded-full font-medium">
                  {recentActivity.length} New
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-[#F9F6F0]">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-[#6B5B52] px-5 py-6 text-center">No recent activity.</p>
                ) : (
                  recentActivity.slice(0, 5).map((s) => (
                    <div key={s.id} className="px-5 py-3 hover:bg-[#F9F6F0] transition">
                      <p className="text-sm text-[#2B221E]">
                        <span className="font-semibold">{s.clientName}</span> booked a session
                      </p>
                      <p className="text-xs text-[#6B5B52] mt-0.5">{s.date} · {s.startTime}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Add Schedule Button */}
        <Link
          to="/therapist/schedule"
          className="w-10 h-10 rounded-2xl bg-[#FF9E4C] flex items-center justify-center text-white hover:bg-[#D96B00] transition-colors shadow-xs hover:shadow-md"
          aria-label="Add Schedule"
        >
          <PlusIcon />
        </Link>

        {/* User Profile Pill */}
        <div className="flex items-center gap-3 pl-3 border-l border-[#E5DCD3] ml-1">
          {therapist?.photoUrl ? (
            <img src={therapist.photoUrl} alt={therapist.name} className="w-10 h-10 rounded-2xl object-cover border border-[#E5DCD3]" />
          ) : (
            <div
              className="w-10 h-10 rounded-2xl bg-[#FF9E4C]/20 flex items-center justify-center text-[#D96B00] text-sm font-bold border border-[#FF9E4C]/30"
              style={{ fontFamily: "Literata, serif" }}
            >
              {initial}
            </div>
          )}
          <div className="hidden lg:block text-left">
            <p className="text-sm font-semibold text-[#2B221E] leading-tight">Dr. {therapist?.name}</p>
            <a
              href={`/${therapist?.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#D96B00] font-medium leading-tight mt-0.5 hover:underline block"
            >
              {slugAddress}
            </a>
          </div>
        </div>

      </div>
    </header>
  );
};

export default Topbar;