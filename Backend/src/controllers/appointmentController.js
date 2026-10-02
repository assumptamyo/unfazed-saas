import Session from "../models/Session.js";
import { generateAvailableSlots, findAvailableSlot } from "../services/slotService.js";
import {
  sendCancellationToClient,
  sendRescheduleToClient,
} from "../services/emailService.js";
import {
  toDateKey,
  dateFromKey,
  todayKey,
  addDaysToKey,
  toDateTime,
} from "../utils/dateUtils.js";

// Where a session sits from the therapist's point of view:
//   upcoming  - confirmed and hasn't ended yet
//   attention - confirmed but already over, so it needs an outcome (completed / no-show)
//   past      - completed or no-show
//   cancelled - cancelled
const getPhase = (session, now = new Date()) => {
  if (session.status === "cancelled") return "cancelled";
  if (session.status === "completed" || session.status === "no-show") return "past";
  return toDateTime(session.date, session.endTime) <= now ? "attention" : "upcoming";
};

const serialize = (session, now = new Date()) => ({
  id: session._id,
  date: toDateKey(session.date),
  startTime: session.startTime,
  endTime: session.endTime,
  status: session.status,
  phase: getPhase(session, now),
  sessionType: session.sessionType,
  notes: session.notes,
  statusUpdatedAt: session.statusUpdatedAt || null,
  cancellation: session.cancellation?.cancelledAt ? session.cancellation : null,
  rescheduleHistory: (session.rescheduleHistory || []).map((h) => ({
    date: toDateKey(h.date),
    startTime: h.startTime,
    endTime: h.endTime,
    rescheduledAt: h.rescheduledAt,
  })),
  createdAt: session.createdAt,
  client: session.client
    ? {
        id: session.client._id,
        name: session.client.name,
        email: session.client.email,
        phone: session.client.phone,
        tags: session.client.tags || [],
      }
    : null,
});

const byStartAsc = (a, b) =>
  a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
const byStartDesc = (a, b) => byStartAsc(b, a);

const findOwnSession = (req) =>
  Session.findOne({ _id: req.params.id, therapist: req.therapist._id }).populate(
    "client",
    "name email phone tags intake"
  );

// @desc   List appointments with per-view counts and summary stats
// @route  GET /api/appointments?view=upcoming|attention|past|cancelled|all&search=
export const getAppointments = async (req, res) => {
  try {
    const view = req.query.view || "upcoming";
    const search = (req.query.search || "").trim().toLowerCase();
    const now = new Date();

    const sessions = await Session.find({ therapist: req.therapist._id })
      .populate("client", "name email phone tags")
      .lean();

    const all = sessions.map((s) => serialize(s, now));

    const counts = { upcoming: 0, attention: 0, past: 0, cancelled: 0, all: all.length };
    all.forEach((a) => (counts[a.phase] += 1));

    // Summary stats for the header
    const today = todayKey();
    const weekEnd = addDaysToKey(today, 7);
    const monthPrefix = today.slice(0, 7);
    const ninetyDaysAgo = addDaysToKey(today, -90);

    const upcoming = all.filter((a) => a.phase === "upcoming").sort(byStartAsc);
    const recentOutcomes = all.filter((a) => a.phase === "past" && a.date >= ninetyDaysAgo);
    const noShows = recentOutcomes.filter((a) => a.status === "no-show").length;

    const summary = {
      today: all.filter((a) => a.date === today && a.status !== "cancelled").length,
      thisWeek: upcoming.filter((a) => a.date < weekEnd).length,
      completedThisMonth: all.filter(
        (a) => a.status === "completed" && a.date.startsWith(monthPrefix)
      ).length,
      noShowRate: recentOutcomes.length
        ? Math.round((noShows / recentOutcomes.length) * 100)
        : null,
      nextSession: upcoming[0] || null,
    };

    let items = view === "all" ? all : all.filter((a) => a.phase === view);

    if (search) {
      items = items.filter(
        (a) =>
          a.client?.name.toLowerCase().includes(search) ||
          a.client?.email.toLowerCase().includes(search)
      );
    }

    // Upcoming reads forward in time; everything else shows the most recent first
    items.sort(view === "upcoming" ? byStartAsc : byStartDesc);

    return res.status(200).json({ appointments: items, counts, summary });
  } catch (error) {
    console.error("Get appointments error:", error.message);
    return res.status(500).json({ message: "Server error while fetching appointments" });
  }
};

// @desc   Single appointment with client intake and history count
// @route  GET /api/appointments/:id
export const getAppointmentById = async (req, res) => {
  try {
    const session = await findOwnSession(req);
    if (!session) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const appointment = serialize(session);

    // The client record may have been deleted; the session itself still exists
    const clientSessions = session.client
      ? await Session.find({ therapist: req.therapist._id, client: session.client._id }).select("status")
      : [];
    if (appointment.client) {
      appointment.client.presentingConcern = session.client.intake?.presentingConcern || "";
    }

    return res.status(200).json({
      appointment,
      clientStats: {
        total: clientSessions.length,
        completed: clientSessions.filter((s) => s.status === "completed").length,
        noShows: clientSessions.filter((s) => s.status === "no-show").length,
      },
    });
  } catch (error) {
    console.error("Get appointment error:", error.message);
    return res.status(500).json({ message: "Server error while fetching appointment" });
  }
};

// @desc   Free slots the therapist can move a session to
// @route  GET /api/appointments/available-slots?days=30&exclude=<sessionId>
export const getRescheduleSlots = async (req, res) => {
  try {
    const slots = await generateAvailableSlots(req.therapist._id, {
      days: req.query.days || 30,
      excludeSessionId: req.query.exclude || null,
    });
    return res.status(200).json({ slots });
  } catch (error) {
    console.error("Get reschedule slots error:", error.message);
    return res.status(500).json({ message: "Server error while fetching slots" });
  }
};

// @desc   Mark completed / no-show, or undo back to confirmed
// @route  PATCH /api/appointments/:id/status
export const updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const session = await findOwnSession(req);
    if (!session) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (session.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled appointments can't be updated" });
    }

    if (status === "confirmed") {
      if (session.status === "confirmed") {
        return res.status(400).json({ message: "Appointment is already confirmed" });
      }
    } else if (toDateTime(session.date, session.startTime) > new Date()) {
      return res.status(400).json({
        message: "You can only record an outcome once the session has started",
      });
    }

    session.status = status;
    session.statusUpdatedAt = new Date();
    await session.save();

    return res.status(200).json({
      message: "Appointment updated",
      appointment: serialize(session),
    });
  } catch (error) {
    console.error("Update appointment status error:", error.message);
    return res.status(500).json({ message: "Server error while updating appointment" });
  }
};

// @desc   Cancel an appointment (frees the slot) and optionally email the client
// @route  POST /api/appointments/:id/cancel
export const cancelAppointment = async (req, res) => {
  try {
    const { reason = "", notifyClient = true } = req.body;
    const session = await findOwnSession(req);
    if (!session) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (session.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed appointments can be cancelled" });
    }

    session.status = "cancelled";
    session.statusUpdatedAt = new Date();
    session.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: "therapist",
      reason: reason.trim(),
    };
    await session.save();

    let emailSent = false;
    if (notifyClient && session.client?.email) {
      try {
        await sendCancellationToClient(
          session.client.email,
          session.client.name,
          req.therapist.name,
          session.date,
          session.startTime,
          session.endTime,
          reason.trim()
        );
        emailSent = true;
      } catch (emailError) {
        console.error("Cancellation email failed:", emailError.message);
      }
    }

    return res.status(200).json({
      message: "Appointment cancelled",
      emailSent,
      appointment: serialize(session),
    });
  } catch (error) {
    console.error("Cancel appointment error:", error.message);
    return res.status(500).json({ message: "Server error while cancelling appointment" });
  }
};

// @desc   Move an appointment to another free slot and optionally email the client
// @route  POST /api/appointments/:id/reschedule
export const rescheduleAppointment = async (req, res) => {
  try {
    const { date, startTime, message = "", notifyClient = true } = req.body;
    const session = await findOwnSession(req);
    if (!session) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (session.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed appointments can be rescheduled" });
    }

    const dateKey = date.slice(0, 10);
    if (dateKey === toDateKey(session.date) && startTime === session.startTime) {
      return res.status(400).json({ message: "Pick a different time to reschedule" });
    }

    const slot = await findAvailableSlot(req.therapist._id, dateKey, startTime, session._id);
    if (!slot) {
      return res.status(409).json({ message: "That time is not available. Please pick another slot." });
    }

    const previous = {
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
    };

    session.rescheduleHistory.push({ ...previous, rescheduledAt: new Date() });
    session.date = dateFromKey(dateKey);
    session.startTime = slot.startTime;
    session.endTime = slot.endTime;
    session.statusUpdatedAt = new Date();
    await session.save();

    let emailSent = false;
    if (notifyClient && session.client?.email) {
      try {
        await sendRescheduleToClient(
          session.client.email,
          session.client.name,
          req.therapist.name,
          previous,
          { date: dateKey, startTime: slot.startTime, endTime: slot.endTime },
          message.trim()
        );
        emailSent = true;
      } catch (emailError) {
        console.error("Reschedule email failed:", emailError.message);
      }
    }

    return res.status(200).json({
      message: "Appointment rescheduled",
      emailSent,
      appointment: serialize(session),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "That slot was just taken. Please pick another time." });
    }
    console.error("Reschedule appointment error:", error.message);
    return res.status(500).json({ message: "Server error while rescheduling appointment" });
  }
};
