import Client from "../models/Client.js";
import Session from "../models/Session.js";

// @desc   Get all clients for the logged-in therapist (with search/filter)
// @route  GET /api/clients
export const getClients = async (req, res) => {
  try {
    const therapistId = req.therapist._id;
    const { search, status } = req.query;

    const query = { therapist: therapistId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const clients = await Client.find(query).sort({ createdAt: -1 });

    const clientIds = clients.map((c) => c._id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
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