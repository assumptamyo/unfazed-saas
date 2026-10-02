import Message from "../models/Message.js";
import Client from "../models/Client.js";
import Therapist from "../models/Therapist.js";
import { emitTo, isOnline } from "../socket.js";
import { createPortalLink } from "./portalService.js";
import { sendNewMessageEmail } from "./emailService.js";

const EMAIL_THROTTLE_MINUTES = 30;
export const PAGE_SIZE = 50;

export const serializeMessage = (m) => ({
  id: m._id,
  clientId: m.client,
  sender: m.sender,
  text: m.text,
  sessionId: m.session || null,
  readAt: m.readAt || null,
  createdAt: m.createdAt,
});

// Newest-first page of a conversation, returned oldest-first for display
export const getThread = async (therapistId, clientId, before) => {
  const query = { therapist: therapistId, client: clientId };
  if (before) query.createdAt = { $lt: new Date(before) };
  const page = await Message.find(query).sort({ createdAt: -1 }).limit(PAGE_SIZE + 1);
  return {
    messages: page.slice(0, PAGE_SIZE).reverse().map(serializeMessage),
    hasMore: page.length > PAGE_SIZE,
  };
};

// Mark the other side's messages as read, and let both sides know
export const markRead = async (therapistId, clientId, reader) => {
  const from = reader === "therapist" ? "client" : "therapist";
  const { modifiedCount } = await Message.updateMany(
    { therapist: therapistId, client: clientId, sender: from, readAt: null },
    { $set: { readAt: new Date() } }
  );
  if (modifiedCount) {
    const payload = { clientId: String(clientId), reader };
    emitTo(`therapist:${therapistId}`, "messages:read", payload);
    emitTo(`client:${clientId}`, "messages:read", payload);
  }
};

export const sendMessage = async ({ therapistId, clientId, sender, text, sessionId }) => {
  const message = await Message.create({
    therapist: therapistId,
    client: clientId,
    sender,
    text,
    session: sessionId || undefined,
  });
  const payload = serializeMessage(message);
  emitTo(`therapist:${therapistId}`, "message:new", payload);
  emitTo(`client:${clientId}`, "message:new", payload);

  // Let the client know by email (without the content) if they're not online,
  // at most once every 30 minutes
  if (sender === "therapist" && !(await isOnline(`client:${clientId}`))) {
    try {
      const client = await Client.findById(clientId);
      const cutoff = Date.now() - EMAIL_THROTTLE_MINUTES * 60000;
      if (client && !client.archivedAt && (!client.lastMessageEmailAt || client.lastMessageEmailAt < cutoff)) {
        const therapist = await Therapist.findById(therapistId).select("name");
        const link = await createPortalLink(client);
        client.lastMessageEmailAt = new Date();
        await client.save();
        await sendNewMessageEmail(client.email, client.name, therapist.name, link);
      }
    } catch (err) {
      console.error("New message email failed:", err.message);
    }
  }

  return payload;
};
