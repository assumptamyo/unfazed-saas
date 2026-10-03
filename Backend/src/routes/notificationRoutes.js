import express from "express";
import { param, query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import Notification from "../models/Notification.js";
import { serializeNotification } from "../services/notificationService.js";

const router = express.Router();
router.use(authMiddleware);

// The therapist's bell: in-app notifications, newest first
router.get("/", async (req, res) => {
  try {
    const filter = { therapist: req.therapist._id, channel: "in_app" };
    const [items, unread] = await Promise.all([
      Notification.find(filter).sort({ updatedAt: -1 }).limit(30),
      Notification.countDocuments({ ...filter, readAt: null }),
    ]);
    return res.status(200).json({ notifications: items.map(serializeNotification), unread });
  } catch (error) {
    console.error("Notifications error:", error.message);
    return res.status(500).json({ message: "Couldn't load notifications" });
  }
});

router.post("/read-all", async (req, res) => {
  await Notification.updateMany(
    { therapist: req.therapist._id, channel: "in_app", readAt: null },
    { $set: { readAt: new Date() } }
  );
  return res.status(200).json({ ok: true });
});

router.post("/:id/read", [param("id").isMongoId()], validateRequest, async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.id, therapist: req.therapist._id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return res.status(200).json({ ok: true });
});

// Everything the NotificationService did for this therapist, on every channel
// (including queued WhatsApp stubs), for the activity log page
router.get(
  "/log",
  [query("channel").optional().isIn(["email", "whatsapp", "in_app"])],
  validateRequest,
  async (req, res) => {
    try {
      const filter = { therapist: req.therapist._id };
      if (req.query.channel) filter.channel = req.query.channel;
      const items = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(150)
        .populate("client", "name")
        .lean();
      return res.status(200).json({
        log: items.map((n) => ({
          id: n._id,
          event: n.event,
          channel: n.channel,
          audience: n.audience,
          status: n.status,
          recipient: n.recipient,
          clientName: n.client?.name || "",
          title: n.title,
          body: n.channel === "whatsapp" ? n.body : n.channel === "in_app" ? n.body : "",
          error: n.error,
          createdAt: n.createdAt,
        })),
      });
    } catch (error) {
      console.error("Notification log error:", error.message);
      return res.status(500).json({ message: "Couldn't load the notification log" });
    }
  }
);

export default router;
