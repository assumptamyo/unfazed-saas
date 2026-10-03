import mongoose from "mongoose";
import Client from "../models/Client.js";
import Session from "../models/Session.js";
import Payment from "../models/Payment.js";
import { dateFromKey, todayKey } from "../utils/dateUtils.js";

// All figures here are computed by MongoDB aggregation pipelines on the server.
// JavaScript only fills in months that have no data so charts have a continuous axis.

const SERVER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// "YYYY-MM" keys for the last n months, oldest first
const lastMonths = (n) => {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
};

const fillMonths = (months, rows, empty) => {
  const byMonth = Object.fromEntries(rows.map((r) => [r._id, r]));
  return months.map((month) => ({ month, ...empty, ...(byMonth[month] || {}), _id: undefined }));
};

// @desc   Headline numbers, available on every plan
// @route  GET /api/analytics/overview
export const getOverview = async (req, res) => {
  try {
    const therapist = oid(req.therapist._id);
    const monthStartKey = `${todayKey().slice(0, 7)}-01`;
    const monthStart = dateFromKey(monthStartKey);
    const today = dateFromKey(todayKey());

    const [clientStats] = await Client.aggregate([
      { $match: { therapist } },
      {
        $group: {
          _id: null,
          activeClients: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$archivedAt", null] }, null] }, 1, 0] } },
          newThisMonth: { $sum: { $cond: [{ $gte: ["$createdAt", monthStart] }, 1, 0] } },
        },
      },
    ]);

    const [sessionStats] = await Session.aggregate([
      { $match: { therapist } },
      {
        $group: {
          _id: null,
          completedThisMonth: {
            $sum: { $cond: [{ $and: [{ $eq: ["$status", "completed"] }, { $gte: ["$date", monthStart] }] }, 1, 0] },
          },
          upcoming: {
            $sum: { $cond: [{ $and: [{ $eq: ["$status", "confirmed"] }, { $gte: ["$date", today] }] }, 1, 0] },
          },
          totalCompleted: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        },
      },
    ]);

    return res.status(200).json({
      activeClients: clientStats?.activeClients || 0,
      newClientsThisMonth: clientStats?.newThisMonth || 0,
      completedThisMonth: sessionStats?.completedThisMonth || 0,
      upcomingSessions: sessionStats?.upcoming || 0,
      totalCompleted: sessionStats?.totalCompleted || 0,
    });
  } catch (error) {
    console.error("Analytics overview error:", error.message);
    return res.status(500).json({ message: "Server error while loading analytics" });
  }
};

// @desc   Trends over time (plan-gated: analytics.advanced)
// @route  GET /api/analytics/advanced?months=6
export const getAdvanced = async (req, res) => {
  try {
    const therapist = oid(req.therapist._id);
    const monthCount = Math.min(Math.max(Number(req.query.months) || 6, 3), 12);
    const months = lastMonths(monthCount);
    const rangeStartLocal = new Date(`${months[0]}-01T00:00:00`); // for real timestamps (paidAt)
    const rangeStartDate = dateFromKey(`${months[0]}-01`); // for calendar dates (session.date)

    const [revenueRows, sessionRows, activeRows, retentionRows] = await Promise.all([
      // Revenue per month: net = paid amount minus anything refunded
      Payment.aggregate([
        { $match: { therapist, status: { $in: ["paid", "refunded"] }, paidAt: { $gte: rangeStartLocal } } },
        {
          $project: {
            month: { $dateToString: { format: "%Y-%m", date: "$paidAt", timezone: SERVER_TZ } },
            amount: 1,
            refunded: { $cond: [{ $eq: ["$status", "refunded"] }, { $ifNull: ["$refund.amount", "$amount"] }, 0] },
          },
        },
        {
          $group: {
            _id: "$month",
            gross: { $sum: "$amount" },
            refunded: { $sum: "$refunded" },
            payments: { $sum: 1 },
          },
        },
        { $addFields: { net: { $subtract: ["$gross", "$refunded"] } } },
      ]),

      // Sessions per month by outcome, with the no-show rate worked out in the pipeline
      Session.aggregate([
        { $match: { therapist, date: { $gte: rangeStartDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            noShow: { $sum: { $cond: [{ $eq: ["$status", "no-show"] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
            booked: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, 1, 0] } },
          },
        },
        {
          $addFields: {
            noShowRate: {
              $cond: [
                { $gt: [{ $add: ["$completed", "$noShow"] }, 0] },
                { $round: [{ $multiply: [{ $divide: ["$noShow", { $add: ["$completed", "$noShow"] }] }, 100] }, 1] },
                null,
              ],
            },
          },
        },
      ]),

      // Active clients per month: distinct clients with at least one non-cancelled session
      Session.aggregate([
        { $match: { therapist, date: { $gte: rangeStartDate }, status: { $ne: "cancelled" } } },
        {
          $group: {
            _id: { month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } }, client: "$client" },
          },
        },
        { $group: { _id: "$_id.month", activeClients: { $sum: 1 } } },
      ]),

      // Retention: of clients who completed a session, how many came back for another
      Session.aggregate([
        { $match: { therapist, status: "completed" } },
        { $group: { _id: "$client", sessions: { $sum: 1 } } },
        {
          $group: {
            _id: null,
            clients: { $sum: 1 },
            returning: { $sum: { $cond: [{ $gte: ["$sessions", 2] }, 1, 0] } },
            avgSessions: { $avg: "$sessions" },
          },
        },
        {
          $project: {
            _id: 0,
            clients: 1,
            returning: 1,
            avgSessions: { $round: ["$avgSessions", 1] },
            retentionRate: {
              $cond: [{ $gt: ["$clients", 0] }, { $round: [{ $multiply: [{ $divide: ["$returning", "$clients"] }, 100] }, 1] }, null],
            },
          },
        },
      ]),
    ]);

    const revenue = fillMonths(months, revenueRows, { gross: 0, refunded: 0, net: 0, payments: 0 });
    const sessions = fillMonths(months, sessionRows, { completed: 0, noShow: 0, cancelled: 0, booked: 0, noShowRate: null });
    const activeClients = fillMonths(months, activeRows, { activeClients: 0 });

    return res.status(200).json({
      months,
      revenue,
      sessions,
      activeClients,
      retention: retentionRows[0] || { clients: 0, returning: 0, avgSessions: null, retentionRate: null },
    });
  } catch (error) {
    console.error("Advanced analytics error:", error.message);
    return res.status(500).json({ message: "Server error while loading analytics" });
  }
};
