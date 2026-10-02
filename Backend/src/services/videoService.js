import crypto from "crypto";
import Session from "../models/Session.js";
import { toDateTime } from "../utils/dateUtils.js";

// Video calls use Daily.co when DAILY_API_KEY is set (private rooms embedded in Unfazed).
// Without a key, a Jitsi Meet room is used as a free development fallback that opens in a new tab.
const DAILY_API = "https://api.daily.co/v1";

// How early / late each side can enter the room, in minutes
const WINDOWS = {
  therapist: { before: 30, after: 60 },
  client: { before: 10, after: 30 },
};

export const videoProvider = () => (process.env.DAILY_API_KEY ? "daily" : "jitsi");

export const joinWindow = (session, role) => {
  const w = WINDOWS[role];
  const start = toDateTime(session.date, session.startTime);
  const end = toDateTime(session.date, session.endTime);
  return {
    opensAt: new Date(start.getTime() - w.before * 60000),
    closesAt: new Date(end.getTime() + w.after * 60000),
  };
};

const daily = async (path, body) => {
  const res = await fetch(`${DAILY_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.info || data.error || "Video service error");
    err.statusCode = 502;
    throw err;
  }
  return data;
};

// Make sure the session has a room that lasts until after the session ends
const ensureRoom = async (session) => {
  const provider = videoProvider();
  const roomExpiry = new Date(joinWindow(session, "therapist").closesAt.getTime() + 30 * 60000);

  if (session.videoRoom?.provider === provider && session.videoRoom.expiresAt > new Date()) {
    return session.videoRoom;
  }

  const name = `unfazed-${crypto.randomBytes(10).toString("hex")}`;
  let url;
  if (provider === "daily") {
    const room = await daily("/rooms", {
      name,
      privacy: "private",
      properties: {
        exp: Math.floor(roomExpiry.getTime() / 1000),
        eject_at_room_exp: true,
        max_participants: 4,
        enable_chat: false, // Unfazed's own chat panel is used instead
        enable_prejoin_ui: true,
      },
    });
    url = room.url;
  } else {
    url = `https://meet.jit.si/${name}`;
  }

  // Two people may join at the same moment: only the first room is saved, and
  // everyone uses that one
  const saved = await Session.findOneAndUpdate(
    {
      _id: session._id,
      $or: [
        { "videoRoom.expiresAt": { $exists: false } },
        { "videoRoom.expiresAt": { $lte: new Date() } },
        { "videoRoom.provider": { $ne: provider } },
      ],
    },
    { $set: { videoRoom: { provider, name, url, expiresAt: roomExpiry } } },
    { new: true }
  );
  const current = saved || (await Session.findById(session._id));
  session.videoRoom = current.videoRoom;
  return current.videoRoom;
};

// Everything the browser needs to join, for one participant
export const getJoinInfo = async (session, { role, displayName }) => {
  if (session.status === "cancelled") {
    const err = new Error("This session was cancelled");
    err.statusCode = 400;
    throw err;
  }

  const { opensAt, closesAt } = joinWindow(session, role);
  const now = new Date();
  if (now < opensAt || now > closesAt) {
    const err = new Error(
      now < opensAt
        ? `The video room opens ${role === "client" ? "10" : "30"} minutes before the session starts`
        : "This session's video room has closed"
    );
    err.statusCode = 403;
    err.opensAt = opensAt;
    throw err;
  }

  const room = await ensureRoom(session);

  if (room.provider === "daily") {
    const { token } = await daily("/meeting-tokens", {
      properties: {
        room_name: room.name,
        user_name: displayName,
        is_owner: role === "therapist",
        exp: Math.floor(room.expiresAt.getTime() / 1000),
      },
    });
    return { provider: "daily", embeddable: true, url: `${room.url}?t=${token}` };
  }

  return {
    provider: "jitsi",
    embeddable: false,
    url: `${room.url}#userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}`,
  };
};
