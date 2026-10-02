import Availability from "../models/Availability.js";
import AvailabilityOverride from "../models/AvailabilityOverride.js";
import Session from "../models/Session.js";

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const combineDateAndTime = (date, timeStr) => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
};

const addMinutes = (timeStr, minutesToAdd) => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;
};

export const generateAvailableSlots = async (therapistId, daysAhead = 14) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + daysAhead);

  const [weeklyTemplates, overrides, existingSessions] = await Promise.all([
    Availability.find({ therapist: therapistId, isActive: true }),
    AvailabilityOverride.find({
      therapist: therapistId,
      date: { $gte: today, $lte: endDate },
    }),
    Session.find({
      therapist: therapistId,
      date: { $gte: today, $lte: endDate },
      status: { $ne: "cancelled" },
    }),
  ]);

  const overrideMap = {};
  overrides.forEach((o) => {
    overrideMap[formatDateKey(o.date)] = o;
  });

  const bookedMap = {};
  existingSessions.forEach((s) => {
    const key = formatDateKey(s.date);
    if (!bookedMap[key]) bookedMap[key] = new Set();
    bookedMap[key].add(s.startTime);
  });

  const result = [];

  for (let i = 0; i < daysAhead; i++) {
    const currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() + i);
    const dateKey = formatDateKey(currentDate);
    const dayOfWeek = currentDate.getDay();

    const override = overrideMap[dateKey];

    if (override && override.type === "blocked") {
      result.push({ date: dateKey, slots: [] });
      continue;
    }

    let dayStart, dayEnd, sessionDuration, bufferMinutes;

    if (override && override.type === "custom") {
      dayStart = override.startTime;
      dayEnd = override.endTime;
      const template = weeklyTemplates.find((t) => t.dayOfWeek === dayOfWeek);
      sessionDuration = template ? template.sessionDuration : 60;
      bufferMinutes = template ? template.bufferMinutes : 0;
    } else {
      const template = weeklyTemplates.find((t) => t.dayOfWeek === dayOfWeek);
      if (!template) {
        result.push({ date: dateKey, slots: [] });
        continue;
      }
      dayStart = template.startTime;
      dayEnd = template.endTime;
      sessionDuration = template.sessionDuration;
      bufferMinutes = template.bufferMinutes;
    }

    const slots = [];
    let cursor = dayStart;
    const stepMinutes = sessionDuration + bufferMinutes;

    while (true) {
      const slotEnd = addMinutes(cursor, sessionDuration);
      if (slotEnd > dayEnd) break;

      const isBooked = bookedMap[dateKey]?.has(cursor);
      const slotDateTime = combineDateAndTime(currentDate, cursor);
      const isPast = slotDateTime < new Date();

      if (!isBooked && !isPast) {
        slots.push({ startTime: cursor, endTime: slotEnd });
      }

      cursor = addMinutes(cursor, stepMinutes);
    }

    result.push({ date: dateKey, slots });
  }

  return result;
};