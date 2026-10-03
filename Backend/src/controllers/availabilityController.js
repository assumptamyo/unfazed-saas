import Availability from "../models/Availability.js";
import AvailabilityOverride from "../models/AvailabilityOverride.js";
import Session from "../models/Session.js";
import { refundSessionPayment } from "../services/paymentService.js";
import { publish, publishInBackground, EVENTS } from "../services/notificationService.js";
import {
  dateFromKey,
  toDateKey,
  todayKey,
  addDaysToKey,
  dayOfWeekFromKey,
  timeToMinutes,
  toDateTime,
} from "../utils/dateUtils.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_OVERRIDE_DAYS = 90;
const MAX_CALENDAR_DAYS = 62;

// @desc   Set/update weekly availability for a specific day
// @route  POST /api/availability
export const setAvailability = async (req, res) => {
  try {
    const therapistId = req.therapist._id;
    const { dayOfWeek, startTime, endTime, sessionDuration, bufferMinutes } = req.body;

    if (timeToMinutes(endTime) - timeToMinutes(startTime) < Number(sessionDuration)) {
      return res.status(400).json({
        message: "End time must be after start time, with room for at least one session",
      });
    }

    // Upsert: if this day already has a rule, replace it; otherwise create one
    const availability = await Availability.findOneAndUpdate(
      { therapist: therapistId, dayOfWeek },
      {
        startTime,
        endTime,
        sessionDuration,
        bufferMinutes: bufferMinutes || 0,
        isActive: true,
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      message: "Availability saved successfully",
      availability,
    });
  } catch (error) {
    console.error("Set availability error:", error.message);
    return res.status(500).json({ message: "Server error while saving availability" });
  }
};

// @desc   Get the logged-in therapist's full weekly availability
// @route  GET /api/availability
export const getMyAvailability = async (req, res) => {
  try {
    const availability = await Availability.find({
      therapist: req.therapist._id,
      isActive: true,
    }).sort({ dayOfWeek: 1 });

    return res.status(200).json({ availability });
  } catch (error) {
    console.error("Get availability error:", error.message);
    return res.status(500).json({ message: "Server error while fetching availability" });
  }
};

// @desc   Deactivate availability for a specific day (not booked elsewhere, just turned off)
// @route  DELETE /api/availability/:dayOfWeek
export const deleteAvailability = async (req, res) => {
  try {
    const { dayOfWeek } = req.params;

    await Availability.findOneAndUpdate(
      { therapist: req.therapist._id, dayOfWeek: Number(dayOfWeek) },
      { isActive: false }
    );

    return res.status(200).json({ message: "Availability removed for this day" });
  } catch (error) {
    console.error("Delete availability error:", error.message);
    return res.status(500).json({ message: "Server error while removing availability" });
  }
};

// ---------- Overrides (time off & special hours) ----------

const serializeOverride = (o) => ({
  id: o._id,
  date: toDateKey(o.date),
  type: o.type,
  startTime: o.startTime || null,
  endTime: o.endTime || null,
  reason: o.reason || "",
});

// Validates an override request (from body or query) and expands it into date keys.
// Returns { error } or { keys, type, startTime, endTime, reason }.
const parseOverrideInput = (input) => {
  const { date, endDate, type, startTime, endTime, reason = "" } = input;
  const fromKey = String(date || "").slice(0, 10);
  const toKey = String(endDate || date || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey)) {
    return { error: "A valid date is required" };
  }
  if (!["blocked", "custom"].includes(type)) {
    return { error: "type must be 'blocked' or 'custom'" };
  }
  if (toKey < fromKey) {
    return { error: "The end date must be on or after the start date" };
  }
  if (fromKey < todayKey()) {
    return { error: "You can't change availability for past dates" };
  }
  if (type === "custom") {
    if (!TIME_PATTERN.test(startTime || "") || !TIME_PATTERN.test(endTime || "")) {
      return { error: "Special hours need a start and end time (HH:mm)" };
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return { error: "End time must be after start time" };
    }
  }

  const keys = [];
  for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) {
    keys.push(key);
    if (keys.length > MAX_OVERRIDE_DAYS) {
      return { error: `You can change at most ${MAX_OVERRIDE_DAYS} days at once` };
    }
  }

  return {
    keys,
    type,
    startTime: type === "custom" ? startTime : undefined,
    endTime: type === "custom" ? endTime : undefined,
    reason: String(reason).trim().slice(0, 200),
  };
};

// Confirmed, not-yet-started sessions that the override would clash with.
// Blocking clashes with every session; special hours only with sessions outside the new window.
const findAffectedSessions = async (therapistId, { keys, type, startTime, endTime }) => {
  const sessions = await Session.find({
    therapist: therapistId,
    status: "confirmed",
    date: { $in: keys.map(dateFromKey) },
  })
    .populate("client", "name email")
    .sort({ date: 1, startTime: 1 });

  const now = new Date();
  return sessions.filter((s) => {
    if (toDateTime(s.date, s.startTime) <= now) return false;
    if (type === "blocked") return true;
    return (
      timeToMinutes(s.startTime) < timeToMinutes(startTime) ||
      timeToMinutes(s.endTime) > timeToMinutes(endTime)
    );
  });
};

const serializeAffected = (s) => ({
  id: s._id,
  date: toDateKey(s.date),
  startTime: s.startTime,
  endTime: s.endTime,
  client: s.client ? { name: s.client.name, email: s.client.email } : null,
});

// @desc   Preview which booked sessions an override would affect
// @route  GET /api/availability/override/impact?date&endDate&type&startTime&endTime
export const getOverrideImpact = async (req, res) => {
  try {
    const parsed = parseOverrideInput(req.query);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const affected = await findAffectedSessions(req.therapist._id, parsed);
    return res.status(200).json({
      days: parsed.keys.length,
      affected: affected.map(serializeAffected),
    });
  } catch (error) {
    console.error("Override impact error:", error.message);
    return res.status(500).json({ message: "Server error while checking bookings" });
  }
};

// @desc   Block a date / date range, or set special hours, optionally cancelling
//         sessions that clash with it
// @route  POST /api/availability/override
export const createOverride = async (req, res) => {
  try {
    const therapistId = req.therapist._id;
    const { cancelAffected = false, notifyClients = true } = req.body;

    const parsed = parseOverrideInput(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    // Find clashes before saving, while the sessions are still confirmed
    const affected = cancelAffected ? await findAffectedSessions(therapistId, parsed) : [];

    await AvailabilityOverride.bulkWrite(
      parsed.keys.map((key) => ({
        updateOne: {
          filter: { therapist: therapistId, date: dateFromKey(key) },
          update: {
            $set: {
              type: parsed.type,
              startTime: parsed.startTime,
              endTime: parsed.endTime,
              reason: parsed.reason,
            },
          },
          upsert: true,
        },
      }))
    );

    let emailsSent = 0;
    const now = new Date();
    for (const session of affected) {
      session.status = "cancelled";
      session.statusUpdatedAt = now;
      session.cancellation = {
        cancelledAt: now,
        cancelledBy: "therapist",
        reason: parsed.reason,
      };
      await session.save();

      let refundedAmount = 0;
      try {
        refundedAmount = await refundSessionPayment(session._id, parsed.reason || "Therapist unavailable");
      } catch (refundError) {
        console.error("Time-off refund failed:", refundError.message);
      }

      const sent = await publish(EVENTS.SESSION_CANCELLED, {
        therapistId: req.therapist._id,
        clientId: session.client?._id,
        sessionId: session._id,
        reason: parsed.reason,
        refundAmount: refundedAmount,
        notifyClient: notifyClients,
      });
      if (sent.email?.client === "sent") emailsSent += 1;
    }

    const overrides = await AvailabilityOverride.find({
      therapist: therapistId,
      date: { $in: parsed.keys.map(dateFromKey) },
    }).sort({ date: 1 });

    return res.status(200).json({
      message: parsed.type === "blocked" ? "Time off saved" : "Special hours saved",
      overrides: overrides.map(serializeOverride),
      cancelledSessions: affected.length,
      emailsSent,
    });
  } catch (error) {
    console.error("Create override error:", error.message);
    return res.status(500).json({ message: "Server error while saving override" });
  }
};

// @desc   Get all overrides for the logged-in therapist (today onwards)
// @route  GET /api/availability/override
export const getMyOverrides = async (req, res) => {
  try {
    const overrides = await AvailabilityOverride.find({
      therapist: req.therapist._id,
      date: { $gte: dateFromKey(todayKey()) },
    }).sort({ date: 1 });

    return res.status(200).json({ overrides: overrides.map(serializeOverride) });
  } catch (error) {
    console.error("Get overrides error:", error.message);
    return res.status(500).json({ message: "Server error while fetching overrides" });
  }
};

// @desc   Delete a specific override (un-block a date)
// @route  DELETE /api/availability/override/:id
export const deleteOverride = async (req, res) => {
  try {
    const { id } = req.params;

    const override = await AvailabilityOverride.findOne({
      _id: id,
      therapist: req.therapist._id,
    });

    if (!override) {
      return res.status(404).json({ message: "Override not found" });
    }

    await override.deleteOne();

    return res.status(200).json({ message: "Override removed" });
  } catch (error) {
    console.error("Delete override error:", error.message);
    return res.status(500).json({ message: "Server error while removing override" });
  }
};

// @desc   Delete several overrides at once (e.g. a whole holiday range)
// @route  POST /api/availability/override/remove
export const removeOverrides = async (req, res) => {
  try {
    const { deletedCount } = await AvailabilityOverride.deleteMany({
      _id: { $in: req.body.ids },
      therapist: req.therapist._id,
    });
    return res.status(200).json({ message: "Removed", removed: deletedCount });
  } catch (error) {
    console.error("Remove overrides error:", error.message);
    return res.status(500).json({ message: "Server error while removing overrides" });
  }
};

// @desc   Day-by-day view of availability, overrides and bookings for a date range
// @route  GET /api/availability/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getAvailabilityCalendar = async (req, res) => {
  try {
    const therapistId = req.therapist._id;
    const fromKey = req.query.from.slice(0, 10);
    let toKey = req.query.to.slice(0, 10);
    if (toKey < fromKey) toKey = fromKey;
    if (addDaysToKey(fromKey, MAX_CALENDAR_DAYS) < toKey) {
      toKey = addDaysToKey(fromKey, MAX_CALENDAR_DAYS);
    }

    const range = { $gte: dateFromKey(fromKey), $lte: dateFromKey(toKey) };
    const [weekly, overrides, sessions] = await Promise.all([
      Availability.find({ therapist: therapistId, isActive: true }),
      AvailabilityOverride.find({ therapist: therapistId, date: range }),
      Session.find({ therapist: therapistId, date: range, status: { $ne: "cancelled" } })
        .populate("client", "name")
        .sort({ startTime: 1 }),
    ]);

    const overrideMap = Object.fromEntries(overrides.map((o) => [toDateKey(o.date), o]));
    const sessionMap = {};
    sessions.forEach((s) => {
      const key = toDateKey(s.date);
      (sessionMap[key] ||= []).push({
        id: s._id,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        clientName: s.client?.name || "Unknown",
      });
    });

    const days = [];
    for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) {
      const template = weekly.find((t) => t.dayOfWeek === dayOfWeekFromKey(key));
      const override = overrideMap[key];

      let kind = "off";
      let hours = null;
      if (override?.type === "blocked") {
        kind = "blocked";
      } else if (override?.type === "custom") {
        kind = "custom";
        hours = { start: override.startTime, end: override.endTime };
      } else if (template) {
        kind = "working";
        hours = { start: template.startTime, end: template.endTime };
      }

      days.push({
        date: key,
        kind,
        hours,
        override: override ? serializeOverride(override) : null,
        sessions: sessionMap[key] || [],
      });
    }

    return res.status(200).json({ days });
  } catch (error) {
    console.error("Availability calendar error:", error.message);
    return res.status(500).json({ message: "Server error while loading calendar" });
  }
};
