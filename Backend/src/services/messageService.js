import Message from "../models/Message.js";
import { emitTo } from "../socket.js";
import { publishInBackground, EVENTS } from "./notificationService.js";

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

  // Email the client if they're offline, or ping the therapist's bell (rules decide which)
  publishInBackground(EVENTS.MESSAGE_SENT, {
    therapistId,
    clientId,
    sender,
    preview: text.length > 90 ? `${text.slice(0, 90)}…` : text,
  });

  return payload;
};
