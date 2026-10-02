import { addDays, differenceInCalendarDays, format, isSameMonth, isSameYear, parseISO } from "date-fns";

export const REASONS = ["Holiday", "Vacation", "Sick day", "Training", "Personal"];

export const KIND_META = {
  working: { label: "Working", color: "#4F7161" },
  off: { label: "Day off", color: "#A89C8F" },
  blocked: { label: "Time off", color: "#C8553D" },
  custom: { label: "Special hours", color: "#B7791F" },
};

export const todayKey = () => format(new Date(), "yyyy-MM-dd");
export const addDaysKey = (key, n) => format(addDays(parseISO(key), n), "yyyy-MM-dd");

// "09:00" -> "9am", "13:30" -> "1:30pm"
export const shortTime = (time) => {
  const d = parseISO(`2000-01-01T${time}`);
  return format(d, d.getMinutes() ? "h:mmaaa" : "haaa");
};

export const formatHours = (start, end) => `${shortTime(start)}–${shortTime(end)}`;

// "Dec 24 – Jan 2", "Dec 24 – 28", "Dec 24"
export const formatRange = (fromKey, toKey) => {
  const a = parseISO(fromKey);
  const b = parseISO(toKey);
  if (fromKey === toKey) return format(a, "EEE, MMM d");
  if (isSameMonth(a, b)) return `${format(a, "MMM d")} – ${format(b, "d")}`;
  if (isSameYear(a, b)) return `${format(a, "MMM d")} – ${format(b, "MMM d")}`;
  return `${format(a, "MMM d, yyyy")} – ${format(b, "MMM d, yyyy")}`;
};

export const dayCount = (fromKey, toKey) => differenceInCalendarDays(parseISO(toKey), parseISO(fromKey)) + 1;

// Merge back-to-back overrides with the same settings into one range,
// so "Dec 24 … Jan 2" shows as a single holiday instead of ten rows
export const groupOverrides = (overrides) => {
  const sorted = [...overrides].sort((a, b) => a.date.localeCompare(b.date));
  const groups = [];
  sorted.forEach((o) => {
    const last = groups[groups.length - 1];
    const sameSettings =
      last &&
      last.type === o.type &&
      last.reason === o.reason &&
      last.startTime === o.startTime &&
      last.endTime === o.endTime &&
      addDaysKey(last.to, 1) === o.date;

    if (sameSettings) {
      last.to = o.date;
      last.ids.push(o.id);
    } else {
      groups.push({
        key: o.id,
        type: o.type,
        reason: o.reason,
        startTime: o.startTime,
        endTime: o.endTime,
        from: o.date,
        to: o.date,
        ids: [o.id],
      });
    }
  });
  return groups;
};
