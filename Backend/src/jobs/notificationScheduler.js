import Session from "../models/Session.js";
import { publish, EVENTS } from "../services/notificationService.js";
import { SCHEDULE } from "../config/notificationRules.js";
import { dateFromKey, todayKey, addDaysToKey, toDateTime, toDateKey } from "../utils/dateUtils.js";

// Time-based notifications: 24-hour reminders and post-session follow-ups.
// Runs every few minutes. Each session is "claimed" with an atomic update before
// publishing, and the NotificationService's dedupe key adds a second guard, so
// overlapping runs (or several server instances) never send the same message twice.

const HOUR = 60 * 60 * 1000;

const claim = (sessionId, field) =>
  Session.findOneAndUpdate(
    { _id: sessionId, [`scheduledNotifications.${field}`]: { $exists: false } },
    { $set: { [`scheduledNotifications.${field}`]: new Date() } },
    { new: true }
  );

export const sendDueReminders = async (now = new Date()) => {
  const candidates = await Session.find({
    status: "confirmed",
    date: { $gte: dateFromKey(todayKey()), $lte: dateFromKey(addDaysToKey(todayKey(), 2)) },
    "scheduledNotifications.reminderSentAt": { $exists: false },
  });

  let sent = 0;
  for (const s of candidates) {
    const start = toDateTime(s.date, s.startTime);
    const msUntil = start - now;
    if (msUntil <= 0 || msUntil > SCHEDULE.reminderHoursBefore * HOUR) continue;
    // Booked within the reminder window: the confirmation email already covers it
    if (s.createdAt > new Date(start - SCHEDULE.reminderHoursBefore * HOUR) && !s.rescheduleHistory?.length) continue;

    if (!(await claim(s._id, "reminderSentAt"))) continue;
    await publish(EVENTS.SESSION_REMINDER, {
      therapistId: s.therapist,
      clientId: s.client,
      sessionId: s._id,
      dedupeKey: `reminder:${s._id}:${toDateKey(s.date)}T${s.startTime}`,
    });
    sent += 1;
  }
  return sent;
};

export const sendDueFollowUps = async (now = new Date()) => {
  const candidates = await Session.find({
    status: "completed",
    date: { $gte: dateFromKey(addDaysToKey(todayKey(), -SCHEDULE.followUpWithinDays)), $lte: dateFromKey(todayKey()) },
    "scheduledNotifications.followUpSentAt": { $exists: false },
  });

  let sent = 0;
  for (const s of candidates) {
    const end = toDateTime(s.date, s.endTime);
    if (now - end < SCHEDULE.followUpHoursAfter * HOUR) continue;

    if (!(await claim(s._id, "followUpSentAt"))) continue;
    await publish(EVENTS.SESSION_FOLLOW_UP, {
      therapistId: s.therapist,
      clientId: s.client,
      sessionId: s._id,
      dedupeKey: `followup:${s._id}`,
    });
    sent += 1;
  }
  return sent;
};

export const runNotificationTick = async () => {
  try {
    const [reminders, followUps] = await Promise.all([sendDueReminders(), sendDueFollowUps()]);
    if (reminders || followUps) console.log(`Notifications: ${reminders} reminder(s), ${followUps} follow-up(s) sent`);
  } catch (error) {
    console.error("Notification scheduler error:", error.message);
  }
};

let timer = null;
export const startNotificationScheduler = () => {
  if (timer) return;
  setTimeout(runNotificationTick, 30 * 1000); // first run shortly after start-up
  timer = setInterval(runNotificationTick, SCHEDULE.tickMinutes * 60 * 1000);
};
