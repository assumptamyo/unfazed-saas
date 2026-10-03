import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { getNotificationLog } from "../../api/notificationApi";

const EVENT_LABELS = {
  "booking.confirmed": "Booking confirmed",
  "session.cancelled": "Session cancelled",
  "session.rescheduled": "Session rescheduled",
  "session.reminder": "24-hour reminder",
  "session.followUp": "Post-session follow-up",
  "note.shared": "Note shared",
  "message.sent": "New message",
  "payment.refunded": "Payment refunded",
};

const CHANNELS = [
  ["", "All"],
  ["email", "Email"],
  ["whatsapp", "WhatsApp"],
  ["in_app", "In-app"],
];

const CHANNEL_LABEL = { email: "Email", whatsapp: "WhatsApp", in_app: "In-app" };

// Status always shows as a word, never colour alone
const STATUS = {
  sent: ["Sent", "bg-[#E7F2EC] text-[#2F6B4A]"],
  stubbed: ["Queued (stub)", "bg-[#EEF0F7] text-[#4A5578]"],
  queued: ["Queued", "bg-[#EEF0F7] text-[#4A5578]"],
  skipped: ["Skipped", "bg-[#F3EBDF] text-[#6B5B52]"],
  failed: ["Failed", "bg-[#FBE9E7] text-[#A33A2B]"],
};

const NotificationLog = () => {
  const [channel, setChannel] = useState("");
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getNotificationLog(channel)
      .then((res) => {
        if (!alive) return;
        setLog(res.data.log || []);
        setError("");
      })
      .catch(() => alive && setError("Couldn't load the activity log."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [channel]);

  const pickChannel = (value) => {
    if (value === channel) return;
    setLoading(true);
    setChannel(value);
  };

  return (
    <DashboardLayout>
      <div className="p-5 sm:p-8 max-w-5xl w-full mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D96B00] mb-2">Notifications</p>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight">Activity log</h1>
            <p className="text-sm text-[#6B5B52] mt-2 max-w-xl">
              Every email, WhatsApp message and alert Unfazed sent for your practice.
            </p>
          </div>
          <div className="flex gap-1 p-1 bg-[#F3EBDF]/70 rounded-2xl" role="group" aria-label="Channel">
            {CHANNELS.map(([value, label]) => (
              <button
                key={label}
                onClick={() => pickChannel(value)}
                aria-pressed={channel === value}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition ${
                  channel === value ? "bg-white text-[#2B221E] shadow-sm" : "text-[#6B5B52] hover:text-[#2B221E]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {channel === "whatsapp" && (
          <div className="mb-4 rounded-2xl border border-[#E1E5F0] bg-[#F5F7FC] px-4 py-3 text-sm text-[#4A5578]">
            WhatsApp isn't connected yet. Messages are prepared and logged here so you can see exactly what clients will receive once it is.
          </div>
        )}

        <div className="bg-white border border-[#EFE6DA] rounded-3xl overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <p className="p-8 text-center text-sm text-[#A33A2B]">{error}</p>
          ) : log.length === 0 ? (
            <p className="p-10 text-center text-sm text-[#6B5B52]">Nothing here yet. Notifications appear as bookings, reminders and messages happen.</p>
          ) : (
            <ul className="divide-y divide-[#F3EBDF]">
              {log.map((n) => {
                const [statusLabel, statusClass] = STATUS[n.status] || [n.status, "bg-[#F3EBDF] text-[#6B5B52]"];
                return (
                  <li key={n.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                    <div className="sm:w-32 shrink-0 text-xs text-[#8A7A6D] pt-0.5">
                      {format(parseISO(n.createdAt), "MMM d, h:mm a")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#2B221E]">
                        {EVENT_LABELS[n.event] || n.event}
                        <span className="font-normal text-[#6B5B52]">
                          {" · "}
                          {CHANNEL_LABEL[n.channel] || n.channel} to {n.audience === "therapist" ? "you" : n.clientName || "client"}
                        </span>
                      </p>
                      {n.recipient && n.audience === "client" && (
                        <p className="text-xs text-[#8A7A6D] mt-0.5 break-all">{n.recipient}</p>
                      )}
                      {n.body && (
                        <p className="text-xs text-[#4A3F38] mt-1.5 bg-[#FBF8F3] border border-[#F0E8DD] rounded-xl px-3 py-2 whitespace-pre-wrap break-words">
                          {n.body}
                        </p>
                      )}
                      {n.error && <p className="text-xs text-[#8A7A6D] mt-1">{n.error}</p>}
                    </div>
                    <span className={`self-start shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default NotificationLog;
