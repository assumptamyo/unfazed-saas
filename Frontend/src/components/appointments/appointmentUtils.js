import { format, parseISO, isToday, isTomorrow, isYesterday, differenceInMinutes } from "date-fns";

// Visual language for each phase/status
export const PHASE_META = {
  upcoming: { label: "Upcoming", color: "#D96B00", soft: "#FFF3E6", ring: "#FFD9AE" },
  attention: { label: "Needs outcome", color: "#B7791F", soft: "#FFF8E6", ring: "#F6DFA8" },
  past: { label: "Past", color: "#4F7161", soft: "#EEF3F0", ring: "#D7E5DC" },
  cancelled: { label: "Cancelled", color: "#9C3B2E", soft: "#FDECEA", ring: "#F5C2BE" },
};

export const STATUS_META = {
  confirmed: { label: "Confirmed", color: "#D96B00", soft: "#FFF3E6" },
  completed: { label: "Completed", color: "#4F7161", soft: "#EEF3F0" },
  "no-show": { label: "No-show", color: "#8A5C77", soft: "#F7EEF3" },
  cancelled: { label: "Cancelled", color: "#9C3B2E", soft: "#FDECEA" },
};

// Stable, warm gradient per client so the same person always looks the same
const AVATAR_GRADIENTS = [
  ["#FF9E4C", "#D96B00"],
  ["#B98EA7", "#8A5C77"],
  ["#8DB3A1", "#4F7161"],
  ["#E8A87C", "#C9602E"],
  ["#C7A27C", "#8A6A4A"],
  ["#F2B880", "#C97B3A"],
  ["#9FB4C7", "#5B7A99"],
];

export const avatarGradient = (seed = "") => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const [a, b] = AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
};

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "?";

export const toMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const durationMinutes = (a) => toMinutes(a.endTime) - toMinutes(a.startTime);

// "2026-10-14" + "10:00" -> local Date
export const startDateTime = (a) => parseISO(`${a.date}T${a.startTime}`);
export const endDateTime = (a) => parseISO(`${a.date}T${a.endTime}`);

export const formatTime = (time) => format(parseISO(`2000-01-01T${time}`), "h:mm a");

export const relativeDayLabel = (dateKey) => {
  const d = parseISO(dateKey);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isYesterday(d)) return "Yesterday";
  return null;
};

export const formatLongDate = (dateKey) => format(parseISO(dateKey), "EEEE, MMMM d");
export const formatShortDate = (dateKey) => format(parseISO(dateKey), "EEE, MMM d");

// "in 2h 15m", "in 3 days", "now", "ended"
export const countdownLabel = (a, now = new Date()) => {
  const start = startDateTime(a);
  const end = endDateTime(a);
  if (now >= start && now < end) return "In session now";
  if (now >= end) return "Ended";

  const mins = differenceInMinutes(start, now);
  if (mins < 1) return "Starting now";
  if (mins < 60) return `Starts in ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Starts in ${hours}h ${mins % 60}m`;
  const days = Math.round(hours / 24);
  return `Starts in ${days} day${days === 1 ? "" : "s"}`;
};

export const partOfDay = (time) => {
  const h = Number(time.slice(0, 2));
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
};

export const apiError = (err, fallback = "Something went wrong. Please try again.") =>
  err?.response?.data?.message || fallback;

