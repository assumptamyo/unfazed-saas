import Notification from "../models/Notification.js";
import Therapist from "../models/Therapist.js";
import Client from "../models/Client.js";
import Session from "../models/Session.js";
import Payment from "../models/Payment.js";
import { NOTIFICATION_RULES } from "../config/notificationRules.js";
import { createPortalLink, frontendUrl } from "./portalService.js";
import { generateReceiptPdf } from "./receiptService.js";
import { emitTo, isOnline } from "../socket.js";
import { toDateKey, dateFromKey } from "../utils/dateUtils.js";
import * as email from "./emailService.js";

// Event-driven notifications.
//   Features call:  await publish(EVENTS.BOOKING_CONFIRMED, { therapistId, clientId, sessionId, ... })
//   This service:   looks up the rules for the event, renders a message per channel and
//                   audience, sends it, and records every attempt in the Notification collection.
// Features never pick channels or call email functions themselves.

export const EVENTS = {
  BOOKING_CONFIRMED: "booking.confirmed",
  SESSION_CANCELLED: "session.cancelled",
  SESSION_RESCHEDULED: "session.rescheduled",
  SESSION_REMINDER: "session.reminder",
  SESSION_FOLLOW_UP: "session.followUp",
  NOTE_SHARED: "note.shared",
  MESSAGE_SENT: "message.sent",
  PAYMENT_REFUNDED: "payment.refunded",
};

const MESSAGE_EMAIL_THROTTLE_MINUTES = 30;

// ---------- formatting helpers ----------
const dayLabel = (date) =>
  dateFromKey(toDateKey(date)).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const time12 = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const when = (s) => (s ? `${dayLabel(s.date)} · ${time12(s.startTime)}` : "");
const rupees = (paise) => `₹${(paise / 100).toLocaleString("en-IN")}`;

// ---------- message templates: TEMPLATES[event][channel][audience](ctx, payload) ----------
// email templates send and return { recipient } (or { skip: "reason" })
// whatsapp templates return the message text
// in_app templates return { title, body, link }
const TEMPLATES = {
  "booking.confirmed": {
    email: {
      client: async ({ therapist, client, session, payment }) => {
        const receipt = payment
          ? {
              amount: payment.amount,
              receiptNumber: payment.receiptNumber,
              receiptUrl: `${process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`}/api/receipts/${payment.receiptToken}`,
              pdf: await generateReceiptPdf({ payment, therapistName: therapist.name }),
            }
          : null;
        await email.sendBookingConfirmationToClient(
          client.email, client.name, therapist.name, toDateKey(session.date), session.startTime, session.endTime,
          receipt, await createPortalLink(client)
        );
        return { recipient: client.email };
      },
      therapist: async ({ therapist, client, session, payment }) => {
        await email.sendNewBookingNotificationToTherapist(
          therapist.email, therapist.name, client.name, client.email, toDateKey(session.date),
          session.startTime, session.endTime, payment?.amount || 0
        );
        return { recipient: therapist.email };
      },
    },
    whatsapp: {
      client: ({ therapist, client, session }) =>
        `Hi ${client.name}, your video session with ${therapist.name} is confirmed for ${when(session)}. Join from your client space: ${frontendUrl()}/portal/login`,
    },
    in_app: {
      therapist: ({ client, session, payment }) => ({
        title: "New booking",
        body: `${client.name} booked ${when(session)}${payment ? ` · paid ${rupees(payment.amount)}` : ""}`,
        link: "/therapist/appointments",
      }),
    },
  },

  "session.cancelled": {
    email: {
      client: async ({ therapist, client, session }, p) => {
        await email.sendCancellationToClient(
          client.email, client.name, therapist.name, session.date, session.startTime, session.endTime,
          p.reason || "", p.refundAmount || 0
        );
        return { recipient: client.email };
      },
    },
    whatsapp: {
      client: ({ therapist, client, session }, p) =>
        `Hi ${client.name}, your session with ${therapist.name} on ${when(session)} has been cancelled.${p.refundAmount ? ` A refund of ${rupees(p.refundAmount)} has been issued.` : ""}`,
    },
  },

  "session.rescheduled": {
    email: {
      client: async ({ therapist, client, session }, p) => {
        await email.sendRescheduleToClient(
          client.email, client.name, therapist.name, p.previous,
          { date: toDateKey(session.date), startTime: session.startTime, endTime: session.endTime }, p.message || ""
        );
        return { recipient: client.email };
      },
    },
    whatsapp: {
      client: ({ therapist, client, session }) =>
        `Hi ${client.name}, your session with ${therapist.name} has moved to ${when(session)}.`,
    },
  },

  "session.reminder": {
    email: {
      client: async ({ therapist, client, session }) => {
        await email.sendSessionReminderToClient(
          client.email, client.name, therapist.name, session.date, session.startTime, session.endTime,
          await createPortalLink(client)
        );
        return { recipient: client.email };
      },
    },
    whatsapp: {
      client: ({ therapist, client, session }) =>
        `Reminder: your session with ${therapist.name} is tomorrow, ${when(session)}. The room opens 10 minutes before.`,
    },
    in_app: {
      therapist: ({ client, session }) => ({
        title: "Session tomorrow",
        body: `${client.name} · ${when(session)}`,
        link: `/therapist/session/${session._id}`,
      }),
    },
  },

  "session.followUp": {
    email: {
      client: async ({ therapist, client }) => {
        await email.sendFollowUpToClient(
          client.email, client.name, therapist.name, `${frontendUrl()}/${therapist.slug}`, await createPortalLink(client)
        );
        return { recipient: client.email };
      },
    },
  },

  "note.shared": {
    email: {
      client: async ({ therapist, client }) => {
        await email.sendSharedNoteEmail(client.email, client.name, therapist.name, await createPortalLink(client));
        return { recipient: client.email };
      },
    },
  },

  "message.sent": {
    email: {
      // Only when the client is offline, at most once every 30 minutes; never includes the text
      client: async ({ therapist, client }) => {
        if (await isOnline(`client:${client._id}`)) return { skip: "client is online" };
        const cutoff = Date.now() - MESSAGE_EMAIL_THROTTLE_MINUTES * 60000;
        if (client.lastMessageEmailAt && client.lastMessageEmailAt > cutoff) return { skip: "recently emailed" };
        await email.sendNewMessageEmail(client.email, client.name, therapist.name, await createPortalLink(client));
        await Client.updateOne({ _id: client._id }, { $set: { lastMessageEmailAt: new Date() } });
        return { recipient: client.email };
      },
    },
    in_app: {
      therapist: ({ client }, p) => ({
        title: `Message from ${client.name}`,
        body: p.preview || "",
        link: `/therapist/messages/${client._id}`,
        // Several messages in a row update one unread notification instead of piling up
        collapseKey: `message:${client._id}`,
      }),
    },
  },

  "payment.refunded": {
    email: {
      client: async ({ therapist, session }, p) => {
        await email.sendSlotTakenRefundToClient(
          p.clientEmail, p.clientName, therapist.name, p.date || toDateKey(session.date), p.startTime || session.startTime, p.amount
        );
        return { recipient: p.clientEmail };
      },
    },
    in_app: {
      therapist: (ctx, p) => ({
        title: "Refund issued",
        body: `${rupees(p.amount)} refunded to ${p.clientName}${p.reason === "slot_taken" ? " (the slot was taken during payment)" : ""}`,
        link: "/therapist/billing",
      }),
    },
  },
};

// ---------- channels ----------
const channels = {
  email: async (render, ctx, payload, audience) => {
    if (audience === "client" && !ctx.client && !payload.clientEmail) return { status: "skipped", error: "no client" };
    if (ctx.client?.archivedAt && payload.event !== "session.cancelled") return { status: "skipped", error: "client archived" };
    const out = await render(ctx, payload);
    if (out?.skip) return { status: "skipped", error: out.skip };
    return { status: "sent", recipient: out?.recipient || "" };
  },

  // Stub: real WhatsApp Business API access needs Meta business approval. The message is
  // rendered and queued exactly as it would be sent, so swapping in a provider later only
  // means replacing this function.
  whatsapp: async (render, ctx, payload) => {
    const phone = ctx.client?.phone;
    if (!phone) return { status: "skipped", error: "client has no phone number" };
    if (ctx.client.whatsappOptIn === false) return { status: "skipped", recipient: phone, error: "client turned off WhatsApp messages" };
    const text = render(ctx, payload);
    console.log(`[WhatsApp stub] to ${phone}: ${text}`);
    return { status: "stubbed", recipient: phone, body: text };
  },

  in_app: async (render, ctx, payload) => {
    const { title, body, link, collapseKey } = render(ctx, payload);
    return { status: "sent", recipient: "therapist", title, body, link, collapseKey };
  },
};

const loadContext = async ({ therapistId, clientId, sessionId, paymentId }) => {
  const [therapist, client, session, payment] = await Promise.all([
    Therapist.findById(therapistId).select("name email slug"),
    clientId ? Client.findById(clientId) : null,
    sessionId ? Session.findById(sessionId) : null,
    paymentId ? Payment.findById(paymentId) : null,
  ]);
  return { therapist, client, session, payment };
};

const serialize = (n) => ({
  id: n._id,
  event: n.event,
  title: n.title,
  body: n.body,
  link: n.link,
  readAt: n.readAt || null,
  createdAt: n.createdAt,
});

/**
 * Announce a domain event. Returns a summary like { email: { client: "sent" }, whatsapp: { client: "stubbed" } }.
 * payload.dedupeKey (optional) makes the whole event idempotent per channel/audience.
 */
export const publish = async (event, payload) => {
  const rules = NOTIFICATION_RULES[event] || [];
  const summary = {};
  if (!rules.length) return summary;

  const ctx = await loadContext(payload);
  if (!ctx.therapist) return summary;

  for (const rule of rules) {
    if (rule.when && !rule.when(payload)) continue;
    const render = TEMPLATES[event]?.[rule.channel]?.[rule.to];
    if (!render) continue;

    const base = {
      event,
      channel: rule.channel,
      audience: rule.to,
      therapist: ctx.therapist._id,
      client: ctx.client?._id,
      session: ctx.session?._id,
    };

    // Claim the dedupe key first, so a scheduled reminder is never sent twice
    let record = null;
    if (payload.dedupeKey) {
      try {
        record = await Notification.create({ ...base, status: "queued", dedupeKey: `${payload.dedupeKey}:${rule.channel}:${rule.to}` });
      } catch (err) {
        if (err.code === 11000) continue; // already handled
        throw err;
      }
    }

    let result;
    try {
      result = await channels[rule.channel](render, ctx, { ...payload, event });
    } catch (err) {
      console.error(`Notification ${event}/${rule.channel}/${rule.to} failed:`, err.message);
      result = { status: "failed", error: err.message };
    }

    const { collapseKey, ...fields } = result;
    if (rule.channel === "in_app" && collapseKey) {
      // Update the existing unread notification of the same kind instead of adding another
      const existing = await Notification.findOneAndUpdate(
        { therapist: ctx.therapist._id, channel: "in_app", readAt: null, link: fields.link, event },
        { $set: { ...fields, updatedAt: new Date() } },
        { new: true }
      );
      if (existing) {
        emitTo(`therapist:${ctx.therapist._id}`, "notification:new", serialize(existing));
        (summary[rule.channel] ||= {})[rule.to] = fields.status;
        continue;
      }
    }

    record = record
      ? await Notification.findByIdAndUpdate(record._id, { $set: fields }, { new: true })
      : await Notification.create({ ...base, ...fields });

    if (rule.channel === "in_app" && record.status === "sent") {
      emitTo(`therapist:${ctx.therapist._id}`, "notification:new", serialize(record));
    }
    (summary[rule.channel] ||= {})[rule.to] = record.status;
  }
  return summary;
};

// Fire-and-forget for places where the caller shouldn't wait (errors are logged, never thrown)
export const publishInBackground = (event, payload) => {
  publish(event, payload).catch((err) => console.error(`Publishing ${event} failed:`, err.message));
};

export const serializeNotification = serialize;
