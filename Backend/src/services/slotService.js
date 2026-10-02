import Availability from "../models/Availability.js";
import AvailabilityOverride from "../models/AvailabilityOverride.js";
import Session from "../models/Session.js";
import Payment from "../models/Payment.js";
import BookingRequest from "../models/BookingRequest.js";
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
// excludeSessionId lets a session being rescheduled ignore its own booking;
// excludePaymentId lets a paid checkout ignore its own slot hold.
export const generateAvailableSlots = async (
  therapistId,
  { days = 14, fromKey = todayKey(), excludeSessionId = null, excludePaymentId = null } = {}
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

  // Slots held by clients who are in the middle of paying
  const holdQuery = {
    therapist: therapistId,
    status: { $in: ["created", "processing"] },
    holdExpiresAt: { $gt: new Date() },
    "booking.date": { $gte: startDate, $lt: endDate },
  };
  if (excludePaymentId) holdQuery._id = { $ne: excludePaymentId };

  const [weeklyTemplates, overrides, existingSessions, holds, pendingRequests] = await Promise.all([
    Availability.find({ therapist: therapistId, isActive: true }),
    AvailabilityOverride.find({
      therapist: therapistId,
      date: { $gte: startDate, $lt: endDate },
    }),
    Session.find(sessionQuery),
    Payment.find(holdQuery).select("booking.date booking.startTime booking.endTime"),
    // Bookings waiting for the client to enter their email code
    BookingRequest.find({
      therapist: therapistId,
      status: "pending",
      expiresAt: { $gt: new Date() },
      "booking.date": { $gte: startDate, $lt: endDate },
    }).select("booking.date booking.startTime booking.endTime"),
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
  [...holds, ...pendingRequests].forEach(({ booking }) => {
    const key = toDateKey(booking.date);
    if (!bookedMap[key]) bookedMap[key] = [];
    bookedMap[key].push([timeToMinutes(booking.startTime), timeToMinutes(booking.endTime)]);
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
export const findAvailableSlot = async (
  therapistId,
  dateKey,
  startTime,
  excludeSessionId = null,
  excludePaymentId = null
) => {
  const [day] = await generateAvailableSlots(therapistId, {
    days: 1,
    fromKey: dateKey,
    excludeSessionId,
    excludePaymentId,
  });
  return day.slots.find((s) => s.startTime === startTime) || null;
};
