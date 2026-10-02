import Availability from "../models/Availability.js";
import AvailabilityOverride from "../models/AvailabilityOverride.js";
import Session from "../models/Session.js";
import {
  toDateKey,
  dateFromKey,
  todayKey,
  addDaysToKey,
  dayOfWeekFromKey,
  timeToMinutes,
  minutesToTime,
  toDateTime,
} from "../utils/dateUtils.js";

export const MAX_DAYS_AHEAD = 60;

// Build the list of free slots for each day in [fromKey, fromKey + days).
// excludeSessionId lets a session being rescheduled ignore its own booking.
export const generateAvailableSlots = async (
  therapistId,
  { days = 14, fromKey = todayKey(), excludeSessionId = null } = {}
) => {
  const dayCount = Math.min(Math.max(Number(days) || 14, 1), MAX_DAYS_AHEAD);
  const startDate = dateFromKey(fromKey);
  const endDate = dateFromKey(addDaysToKey(fromKey, dayCount));

  const sessionQuery = {
    therapist: therapistId,
    date: { $gte: startDate, $lt: endDate },
    status: { $ne: "cancelled" },
  };
  if (excludeSessionId) sessionQuery._id = { $ne: excludeSessionId };

  const [weeklyTemplates, overrides, existingSessions] = await Promise.all([
    Availability.find({ therapist: therapistId, isActive: true }),
    AvailabilityOverride.find({
      therapist: therapistId,
      date: { $gte: startDate, $lt: endDate },
    }),
    Session.find(sessionQuery),
  ]);

  const overrideMap = {};
  overrides.forEach((o) => {
    overrideMap[toDateKey(o.date)] = o;
  });

  // Booked time ranges per day, in minutes, so overlaps are caught
  // even when sessions have different lengths
  const bookedMap = {};
  existingSessions.forEach((s) => {
    const key = toDateKey(s.date);
    if (!bookedMap[key]) bookedMap[key] = [];
    bookedMap[key].push([timeToMinutes(s.startTime), timeToMinutes(s.endTime)]);
  });

  const now = new Date();
  const result = [];

  for (let i = 0; i < dayCount; i++) {
    const dateKey = addDaysToKey(fromKey, i);
    const template = weeklyTemplates.find((t) => t.dayOfWeek === dayOfWeekFromKey(dateKey));
    const override = overrideMap[dateKey];

    let window = null;
    if (override?.type === "blocked") {
      window = null;
    } else if (override?.type === "custom" && override.startTime && override.endTime) {
      window = {
        start: override.startTime,
        end: override.endTime,
        duration: template?.sessionDuration ?? 60,
        buffer: template?.bufferMinutes ?? 0,
      };
    } else if (template) {
      window = {
        start: template.startTime,
        end: template.endTime,
        duration: template.sessionDuration,
        buffer: template.bufferMinutes,
      };
    }

    const slots = [];
    if (window) {
      const dayEnd = timeToMinutes(window.end);
      const step = window.duration + (window.buffer || 0);
      const booked = bookedMap[dateKey] || [];

      for (
        let cursor = timeToMinutes(window.start);
        cursor + window.duration <= dayEnd;
        cursor += step
      ) {
        const slotEnd = cursor + window.duration;
        const overlaps = booked.some(([bStart, bEnd]) => cursor < bEnd && slotEnd > bStart);
        const startTime = minutesToTime(cursor);
        const isPast = toDateTime(dateKey, startTime) <= now;

        if (!overlaps && !isPast) {
          slots.push({ startTime, endTime: minutesToTime(slotEnd) });
        }
      }
    }

    result.push({ date: dateKey, slots });
  }

  return result;
};

// Returns the matching free slot, or null if that date/time can't be booked
export const findAvailableSlot = async (therapistId, dateKey, startTime, excludeSessionId = null) => {
  const [day] = await generateAvailableSlots(therapistId, {
    days: 1,
    fromKey: dateKey,
    excludeSessionId,
  });
  return day.slots.find((s) => s.startTime === startTime) || null;
};
