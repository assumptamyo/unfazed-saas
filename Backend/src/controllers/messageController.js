import mongoose from "mongoose";
import Message from "../models/Message.js";
import Client from "../models/Client.js";
import Session from "../models/Session.js";
import { getThread, markRead, sendMessage } from "../services/messageService.js";

const findOwnClient = (req) => Client.findOne({ _id: req.params.clientId, therapist: req.therapist._id });

// @desc   Conversations with their latest message and unread count, newest first
// @route  GET /api/messages/conversations
export const getConversations = async (req, res) => {
  try {
    const therapistId = new mongoose.Types.ObjectId(String(req.therapist._id));
    const rows = await Message.aggregate([
      { $match: { therapist: therapistId } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$client",
          last: { $first: "$$ROOT" },
          unread: {
            $sum: { $cond: [{ $and: [{ $eq: ["$sender", "client"] }, { $eq: [{ $ifNull: ["$readAt", null] }, null] }] }, 1, 0] },
          },
        },
      },
      { $sort: { "last.createdAt": -1 } },
    ]);

    const clients = await Client.find({ _id: { $in: rows.map((r) => r._id) } }).select("name email archivedAt");
    const byId = Object.fromEntries(clients.map((c) => [String(c._id), c]));

    const conversations = rows
      .filter((r) => byId[String(r._id)])
      .map((r) => {
        const c = byId[String(r._id)];
        return {
          client: { id: c._id, name: c.name, email: c.email, archived: !!c.archivedAt },
          lastMessage: { text: r.last.text, sender: r.last.sender, createdAt: r.last.createdAt },
          unread: r.unread,
        };
      });

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("Conversations error:", error.message);
    return res.status(500).json({ message: "Server error while loading messages" });
  }
};

// @desc   Total unread messages, for the top bar badge
// @route  GET /api/messages/unread-count
export const getUnreadCount = async (req, res) => {
  const count = await Message.countDocuments({ therapist: req.therapist._id, sender: "client", readAt: null });
  return res.status(200).json({ count });
};

// @desc   One conversation; opening it marks the client's messages as read
// @route  GET /api/messages/:clientId?before=
export const getConversation = async (req, res) => {
  const client = await findOwnClient(req);
  if (!client) {
    return res.status(404).json({ message: "Client not found" });
  }
  const thread = await getThread(req.therapist._id, client._id, req.query.before);
  await markRead(req.therapist._id, client._id, "therapist");
  return res.status(200).json({
    client: { id: client._id, name: client.name, email: client.email, archived: !!client.archivedAt },
    ...thread,
  });
};

// @route  POST /api/messages/:clientId
export const sendTherapistMessage = async (req, res) => {
  try {
    const client = await findOwnClient(req);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    let sessionId;
    if (req.body.sessionId) {
      const session = await Session.findOne({ _id: req.body.sessionId, therapist: req.therapist._id, client: client._id });
      sessionId = session?._id;
    }
    const message = await sendMessage({
      therapistId: req.therapist._id,
      clientId: client._id,
      sender: "therapist",
      text: req.body.text,
      sessionId,
    });
    return res.status(201).json({ message });
  } catch (error) {
    console.error("Send message error:", error.message);
    return res.status(500).json({ message: "Couldn't send the message" });
  }
};

// @route  POST /api/messages/:clientId/read
export const markConversationRead = async (req, res) => {
  const client = await findOwnClient(req);
  if (!client) {
    return res.status(404).json({ message: "Client not found" });
  }
  await markRead(req.therapist._id, client._id, "therapist");
  return res.status(200).json({ ok: true });
};
