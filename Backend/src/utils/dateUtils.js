// Calendar dates (session/override dates) are stored as UTC midnight of that day,
// e.g. "2026-10-14" -> 2026-10-14T00:00:00.000Z. Times of day are "HH:mm" strings
// in the practice's local time. These helpers keep both conventions consistent.

const pad = (n) => String(n).padStart(2, "0");

// Stored Date -> "YYYY-MM-DD"
export const toDateKey = (date) => new Date(date).toISOString().slice(0, 10);

// "YYYY-MM-DD" -> stored Date (UTC midnight)
export const dateFromKey = (key) => new Date(`${key}T00:00:00.000Z`);

// Today's calendar date in server-local time, as "YYYY-MM-DD"
export const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const addDaysToKey = (key, days) => {
  const d = dateFromKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
};

export const dayOfWeekFromKey = (key) => dateFromKey(key).getUTCDay();

export const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

// The real moment a session starts, in server-local time
export const toDateTime = (dateKeyOrDate, time) => {
  const key = typeof dateKeyOrDate === "string" ? dateKeyOrDate : toDateKey(dateKeyOrDate);
  return new Date(`${key}T${time}:00`);
};
