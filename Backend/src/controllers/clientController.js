import Client from "../models/Client.js";
import Session from "../models/Session.js";
import { dateFromKey, todayKey, toDateTime } from "../utils/dateUtils.js";
import { sendCancellationToClient } from "../services/emailService.js";

// @desc   Get all clients for the logged-in therapist (with search/filter)
// @route  GET /api/clients
export const getClients = async (req, res) => {
  try {
    const therapistId = req.therapist._id;
    const { search, status } = req.query;

    const query = { therapist: therapistId };
    query.archivedAt = status === "archived" ? { $ne: null } : null;

    if (search) {
      // Escape regex characters so input like "(" is matched literally
      const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: pattern, $options: "i" } },
        { email: { $regex: pattern, $options: "i" } },
      ];
    }

    const clients = await Client.find(query).sort({ createdAt: -1 });

    const clientIds = clients.map((c) => c._id);
    const today = dateFromKey(todayKey());

    // Last session + total session count, per client
    const sessionStats = await Session.aggregate([
      { $match: { client: { $in: clientIds } } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: "$client",
          lastSessionDate: { $first: "$date" },
          totalSessions: { $sum: 1 },
        },
      },
    ]);

    // Which clients have at least one upcoming (today or later) confirmed session
    const upcomingClientIds = await Session.distinct("client", {
      client: { $in: clientIds },
      date: { $gte: today },
      status: "confirmed",
    });
    const upcomingSet = new Set(upcomingClientIds.map((id) => id.toString()));

    const statsMap = {};
    sessionStats.forEach((s) => {
      statsMap[s._id.toString()] = {
        lastSessionDate: s.lastSessionDate,
        totalSessions: s.totalSessions,
      };
    });

    let result = clients.map((c) => {
      const idStr = c._id.toString();
      const computedStatus = upcomingSet.has(idStr) ? "active" : "inactive";

      return {
        id: c._id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        status: computedStatus,
        tags: c.tags,
        createdAt: c.createdAt,
        archivedAt: c.archivedAt,
        lastSessionDate: statsMap[idStr]?.lastSessionDate || null,
        totalSessions: statsMap[idStr]?.totalSessions || 0,
      };
    });

    // Apply status filter after computing it (can't filter in the DB query since it's derived)
    if (status && ["active", "inactive"].includes(status)) {
      result = result.filter((c) => c.status === status);
    }

    return res.status(200).json({ clients: result });
  } catch (error) {
    console.error("Get clients error:", error.message);
    return res.status(500).json({ message: "Server error while fetching clients" });
  }
};

// @desc   Get a single client's full detail, including session history
// @route  GET /api/clients/:id
export const getClientById = async (req, res) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      therapist: req.therapist._id,
    });

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const sessions = await Session.find({
      client: client._id,
      therapist: req.therapist._id,
    }).sort({ date: -1 });

    const today = dateFromKey(todayKey());
    const hasUpcoming = sessions.some(
      (s) => new Date(s.date) >= today && s.status === "confirmed"
    );

    return res.status(200).json({
      client: {
        ...client.toObject(),
        status: hasUpcoming ? "active" : "inactive",
      },
      sessions,
    });
  } catch (error) {
    console.error("Get client detail error:", error.message);
    return res.status(500).json({ message: "Server error while fetching client" });
  }
};

// @desc   Update a client's tags or phone (status is no longer manually settable)
// @route  PUT /api/clients/:id
export const updateClient = async (req, res) => {
  try {
    const allowedFields = ["tags", "phone"];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, therapist: req.therapist._id },
      updates,
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    return res.status(200).json({ message: "Client updated successfully", client });
  } catch (error) {
    console.error("Update client error:", error.message);
    return res.status(500).json({ message: "Server error while updating client" });
  }
};

// Confirmed sessions for this client that haven't started yet
const findUpcomingSessions = (therapistId, clientId) =>
  Session.find({
    therapist: therapistId,
    client: clientId,
    status: "confirmed",
    date: { $gte: dateFromKey(todayKey()) },
  }).then((sessions) => sessions.filter((s) => toDateTime(s.date, s.startTime) > new Date()));

// @desc   Archive a client: hide them from lists, keep their history,
//         and cancel any upcoming sessions so the slots open up again
// @route  POST /api/clients/:id/archive
export const archiveClient = async (req, res) => {
  try {
    const { notifyClient = false } = req.body;
    const client = await Client.findOne({ _id: req.params.id, therapist: req.therapist._id });
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    if (client.archivedAt) {
      return res.status(400).json({ message: "Client is already archived" });
    }

    const upcoming = await findUpcomingSessions(req.therapist._id, client._id);
    const now = new Date();
    for (const session of upcoming) {
      session.status = "cancelled";
      session.statusUpdatedAt = now;
      session.cancellation = { cancelledAt: now, cancelledBy: "therapist", reason: "" };
      await session.save();

      if (notifyClient) {
        try {
          await sendCancellationToClient(
            client.email,
            client.name,
            req.therapist.name,
            session.date,
            session.startTime,
            session.endTime,
            ""
          );
        } catch (emailError) {
          console.error("Archive cancellation email failed:", emailError.message);
        }
      }
    }

    client.archivedAt = now;
    await client.save();

    return res.status(200).json({
      message: "Client archived",
      cancelledSessions: upcoming.length,
      client,
    });
  } catch (error) {
    console.error("Archive client error:", error.message);
    return res.status(500).json({ message: "Server error while archiving client" });
  }
};

// @desc   Restore an archived client
// @route  POST /api/clients/:id/restore
export const restoreClient = async (req, res) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, therapist: req.therapist._id },
      { archivedAt: null },
      { new: true }
    );
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    return res.status(200).json({ message: "Client restored", client });
  } catch (error) {
    console.error("Restore client error:", error.message);
    return res.status(500).json({ message: "Server error while restoring client" });
  }
};

// @desc   Permanently delete a client and all of their sessions
// @route  DELETE /api/clients/:id
export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, therapist: req.therapist._id });
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const { deletedCount } = await Session.deleteMany({
      therapist: req.therapist._id,
      client: client._id,
    });
    await client.deleteOne();

    return res.status(200).json({
      message: "Client and their sessions were permanently deleted",
      deletedSessions: deletedCount,
    });
  } catch (error) {
    console.error("Delete client error:", error.message);
    return res.status(500).json({ message: "Server error while deleting client" });
  }
};
