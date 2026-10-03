import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import { useSocketEvents } from "../../hooks/useSocket";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../../api/notificationApi";

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const timeAgo = (iso) => {
  try {
    return `${formatDistanceToNowStrict(parseISO(iso))} ago`;
  } catch {
    return "";
  }
};

// The therapist's in-app notifications: bookings, reminders, messages, refunds.
// New ones arrive live over the socket ("notification:new").
const NotificationBell = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    getNotifications()
      .then((res) => {
        if (!alive) return;
        setItems(res.data.notifications || []);
        setUnread(res.data.unread || 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useSocketEvents(token, {
    "notification:new": (n) => {
      const existed = items.find((x) => x.id === n.id);
      // A brand-new unread item (or one that was read and is now unread again) bumps the count
      if (!n.readAt && (!existed || existed.readAt)) setUnread((c) => c + 1);
      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 30));
    },
  });

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAll = async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnread(0);
    markAllNotificationsRead().catch(() => {});
  };

  const openItem = (n) => {
    if (!n.readAt) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((c) => Math.max(0, c - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-2xl bg-[#F9F6F0] border border-[#E5DCD3] flex items-center justify-center text-[#6B5B52] hover:border-[#FF9E4C] hover:text-[#D96B00] transition relative"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-[#FF9E4C] text-[#211A16] text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] bg-white border border-[#E5DCD3] rounded-3xl shadow-xl py-3 z-30 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-5 pb-2 border-b border-[#E5DCD3] flex items-center justify-between">
            <p className="text-xs font-semibold text-[#6B5B52] uppercase tracking-wider">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] font-medium text-[#D96B00] hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#F9F6F0]">
            {items.length === 0 ? (
              <p className="text-sm text-[#6B5B52] px-5 py-6 text-center">You're all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-5 py-3 hover:bg-[#F9F6F0] transition flex gap-3 ${n.readAt ? "" : "bg-[#FFF8F0]"}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : "bg-[#FF9E4C]"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#2B221E]">{n.title}</span>
                    {n.body && <span className="block text-xs text-[#6B5B52] mt-0.5 break-words">{n.body}</span>}
                    <span className="block text-[10px] text-[#A89C8F] mt-1">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="px-5 pt-2 border-t border-[#E5DCD3]">
            <Link
              to="/therapist/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-[#6B5B52] hover:text-[#D96B00] py-1"
            >
              View all activity →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
