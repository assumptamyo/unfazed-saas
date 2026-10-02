import Session from "../models/Session.js";
import Therapist from "../models/Therapist.js";
import Client from "../models/Client.js";
import LoginCode from "../models/LoginCode.js";
import { exchangePortalToken, issueClientToken } from "../services/portalService.js";
import { generateCode, hashCode, checkCode, resendBlocked, CODE_TTL_MINUTES } from "../services/codeService.js";
import { sendVerificationCodeEmail } from "../services/emailService.js";
import { getJoinInfo, joinWindow, videoProvider } from "../services/videoService.js";
import { getThread, markRead, sendMessage } from "../services/messageService.js";
import { toDateKey, todayKey, dateFromKey, addDaysToKey, toDateTime } from "../utils/dateUtils.js";

// @desc   Exchange the private link from an email for a client login token
// @route  POST /api/portal/session   (public)
export const startPortalSession = async (req, res) => {
  const result = await exchangePortalToken(req.body.token);
  if (!result) {
    return res.status(401).json({
      message: "This link has expired or is no longer valid. Ask your therapist to send a new one.",
    });
  }
  return res.status(200).json({
    token: result.token,
    client: { id: result.client._id, name: result.client.name },
  });
};

// @desc   The client's space: who their therapist is and their sessions.
//         Never includes therapist notes or other clients' data.
// @route  GET /api/portal/me
export const getPortal = async (req, res) => {
  try {
    const client = req.client;
    const [therapist, sessions] = await Promise.all([
      Therapist.findById(client.therapist).select("name slug photoUrl qualifications"),
      Session.find({
        therapist: client.therapist,
        client: client._id,
        date: { $gte: dateFromKey(addDaysToKey(todayKey(), -90)) },
      }).sort({ date: 1, startTime: 1 }),
    ]);

    const now = new Date();
    const items = sessions.map((s) => {
      const { opensAt, closesAt } = joinWindow(s, "client");
      return {
        id: s._id,
        date: toDateKey(s.date),
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        format: s.format || "video",
        joinOpensAt: opensAt,
        joinClosesAt: closesAt,
        isPast: toDateTime(s.date, s.endTime) < now,
      };
    });

    return res.status(200).json({
      client: { id: client._id, name: client.name, email: client.email },
      therapist: therapist
        ? {
            name: therapist.name,
            slug: therapist.slug,
            photoUrl: therapist.photoUrl,
            qualifications: therapist.qualifications,
          }
        : null,
      upcoming: items.filter((s) => !s.isPast && s.status === "confirmed"),
      past: items.filter((s) => s.isPast || s.status !== "confirmed").reverse().slice(0, 10),
      videoProvider: videoProvider(),
    });
  } catch (error) {
    console.error("Portal error:", error.message);
    return res.status(500).json({ message: "Server error while loading your space" });
  }
};

// @desc   Join the video call for one of the client's own sessions
// @route  POST /api/portal/sessions/:id/video
export const joinVideoAsClient = async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, client: req.client._id });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    const info = await getJoinInfo(session, { role: "client", displayName: req.client.name });
    return res.status(200).json(info);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Couldn't open the video room",
      opensAt: error.opensAt,
    });
  }
};

// @desc   The client's message thread with their therapist
// @route  GET /api/portal/messages?before=
export const getClientMessages = async (req, res) => {
  const { client } = req;
  const thread = await getThread(client.therapist, client._id, req.query.before);
  await markRead(client.therapist, client._id, "client");
  return res.status(200).json(thread);
};

// @route  POST /api/portal/messages
export const sendClientMessage = async (req, res) => {
  try {
    const { client } = req;
    let sessionId;
    if (req.body.sessionId) {
      const session = await Session.findOne({ _id: req.body.sessionId, client: client._id }).select("_id");
      sessionId = session?._id;
    }
    const message = await sendMessage({
      therapistId: client.therapist,
      clientId: client._id,
      sender: "client",
      text: req.body.text,
      sessionId,
    });
    return res.status(201).json({ message });
  } catch (error) {
    console.error("Client message error:", error.message);
    return res.status(500).json({ message: "Couldn't send your message" });
  }
};

// @route  POST /api/portal/messages/read
export const markClientRead = async (req, res) => {
  await markRead(req.client.therapist, req.client._id, "client");
  return res.status(200).json({ ok: true });
};

const GENERIC_SENT = "If you have sessions booked with that email, we've sent you a 6-digit code.";

// @desc   Email a sign-in code to a client. Always answers the same way so it
//         never reveals whether an email belongs to a client.
// @route  POST /api/portal/login/request   (public)
export const requestLoginCode = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const client = await Client.findOne({ email, archivedAt: null });
    if (!client) {
      return res.status(200).json({ message: GENERIC_SENT });
    }

    let record = await LoginCode.findOne({ email });
    if (record && record.expiresAt > new Date()) {
      const blocked = resendBlocked(record);
      if (blocked) return res.status(429).json({ message: blocked });
    }

    const code = generateCode();
    const fresh = !record || record.expiresAt <= new Date();
    record = await LoginCode.findOneAndUpdate(
      { email },
      {
        $set: {
          codeHash: hashCode(code),
          attempts: 0,
          lastSentAt: new Date(),
          expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60000),
          sends: fresh ? 1 : (record.sends || 0) + 1,
        },
      },
      { upsert: true, new: true }
    );

    try {
      await sendVerificationCodeEmail(email, client.name, code, "signin");
    } catch (emailError) {
      // Same reply either way, so a failure can't reveal that this email is a client
      console.error("Sign-in code email failed:", emailError.message);
    }
    return res.status(200).json({ message: GENERIC_SENT });
  } catch (error) {
    console.error("Login code error:", error.message);
    return res.status(500).json({ message: "Couldn't send a code right now. Please try again." });
  }
};

// @desc   Check the sign-in code. A client who sees several therapists gets one
//         login per therapist to choose from.
// @route  POST /api/portal/login/verify   (public)
export const verifyLoginCode = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const record = await LoginCode.findOne({ email });
    const problem = await checkCode(record, req.body.code);
    if (problem) {
      return res.status(400).json({ message: problem });
    }
    await record.deleteOne(); // one use only

    const clients = await Client.find({ email, archivedAt: null }).populate("therapist", "name");
    if (!clients.length) {
      return res.status(400).json({ message: "No sessions found for this email." });
    }

    return res.status(200).json({
      accounts: clients.map((c) => ({
        token: issueClientToken(c),
        clientName: c.name,
        therapistName: c.therapist?.name || "Your therapist",
      })),
    });
  } catch (error) {
    console.error("Verify login error:", error.message);
    return res.status(500).json({ message: "Couldn't sign you in right now. Please try again." });
  }
};
