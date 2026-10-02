import Client from "../models/Client.js";
import Session from "../models/Session.js";
import Availability from "../models/Availability.js";

export const getDashboardStats = async (req, res) => {
  try {
    const therapistId = req.therapist._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

    const [
      totalClients,
      upcomingSessions,
      sessionsThisWeek,
      activeScheduleDays,
      bookingsRaw,
      recentSessions,
      upcomingList,
      recentClients,
    ] = await Promise.all([
      Client.countDocuments({ therapist: therapistId }),
      Session.countDocuments({
        therapist: therapistId,
        date: { $gte: today },
        status: "confirmed",
      }),
      Session.countDocuments({
        therapist: therapistId,
        date: { $gte: today, $lte: weekFromNow },
        status: "confirmed",
      }),
      Availability.countDocuments({ therapist: therapistId, isActive: true }),
      Session.aggregate([
        {
          $match: {
            therapist: therapistId,
            createdAt: { $gte: fourteenDaysAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]),
      Session.find({ therapist: therapistId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("client", "name email"),
      Session.find({
        therapist: therapistId,
        date: { $gte: today },
        status: "confirmed",
      })
        .sort({ date: 1, startTime: 1 })
        .limit(8)
        .populate("client", "name email phone"),
      Client.find({ therapist: therapistId })
        .sort({ createdAt: -1 })
        .limit(6),
    ]);

    const bookingsMap = {};
    bookingsRaw.forEach((b) => (bookingsMap[b._id] = b.count));

    const bookingsOverTime = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(fourteenDaysAgo);
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${year}-${month}-${day}`;
      bookingsOverTime.push({ date: key, count: bookingsMap[key] || 0 });
    }

    const recentActivity = recentSessions.map((s) => ({
      id: s._id,
      clientName: s.client?.name || "Unknown",
      date: s.date,
      startTime: s.startTime,
      status: s.status,
    }));

    const upcomingAppointments = upcomingList.map((s) => ({
      id: s._id,
      clientName: s.client?.name || "Unknown",
      clientEmail: s.client?.email || "",
      clientPhone: s.client?.phone || "",
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
    }));

    const recentClientsList = recentClients.map((c) => ({
      id: c._id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.status,
      tags: c.tags,
      createdAt: c.createdAt,
    }));

    return res.status(200).json({
      totalClients,
      upcomingSessions,
      sessionsThisWeek,
      activeScheduleDays,
      bookingsOverTime,
      recentActivity,
      upcomingAppointments,
      recentClients: recentClientsList,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error.message);
    return res.status(500).json({ message: "Server error while fetching dashboard stats" });
  }
};