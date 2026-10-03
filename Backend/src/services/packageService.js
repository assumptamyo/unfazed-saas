import Package from "../models/Package.js";
import ClientPackage from "../models/ClientPackage.js";
import Session from "../models/Session.js";
import { dateFromKey, todayKey, toDateKey } from "../utils/dateUtils.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Suggested validity when a therapist first turns a package on
export const DEFAULT_VALIDITY_DAYS = { 3: 45, 6: 90, 12: 180 };

export const serializePackage = (p) => ({
  id: p._id,
  sessionCount: p.sessionCount,
  pricePerSession: p.pricePerSession,
  totalPrice: p.sessionCount * p.pricePerSession,
  validityDays: p.validityDays,
  active: p.active,
});

export const serializeClientPackage = (cp) => {
  const remaining = Math.max(0, cp.sessionsTotal - cp.sessionsUsed);
  const expired = cp.expiresAt < dateFromKey(todayKey());
  let state = "active";
  if (cp.status === "refunded") state = "refunded";
  else if (remaining === 0) state = "used";
  else if (expired) state = "expired";
  return {
    id: cp._id,
    sessionsTotal: cp.sessionsTotal,
    sessionsUsed: cp.sessionsUsed,
    remaining,
    pricePerSession: cp.pricePerSession,
    amountPaid: cp.amountPaid,
    purchasedAt: cp.purchasedAt,
    expiresAt: toDateKey(cp.expiresAt),
    state,
  };
};

// Packages shown on the public booking page
export const listOfferedPackages = (therapistId) =>
  Package.find({ therapist: therapistId, active: true }).sort({ sessionCount: 1 });

/**
 * Use one credit from the client's oldest usable package for a session on dateKey.
 * Atomic: two bookings at once can't both take the last credit.
 * Returns the ClientPackage (after the update) or null if none is usable.
 */
export const redeemCredit = (therapistId, clientId, dateKey) =>
  ClientPackage.findOneAndUpdate(
    {
      therapist: therapistId,
      client: clientId,
      status: "active",
      expiresAt: { $gte: dateFromKey(dateKey) },
      $expr: { $lt: ["$sessionsUsed", "$sessionsTotal"] },
    },
    { $inc: { sessionsUsed: 1 } },
    { new: true, sort: { expiresAt: 1 } }
  );

// Give a credit back (booking failed, or the therapist cancelled the session)
export const returnCredit = (clientPackageId) =>
  ClientPackage.updateOne(
    { _id: clientPackageId, sessionsUsed: { $gt: 0 } },
    { $inc: { sessionsUsed: -1 } }
  );

/**
 * The therapist cancelled a session booked with a package: return its credit once.
 * Returns true if a credit went back.
 */
export const returnSessionCredit = async (sessionId) => {
  const session = await Session.findOneAndUpdate(
    { _id: sessionId, clientPackage: { $exists: true, $ne: null }, packageCreditReturned: { $ne: true } },
    { $set: { packageCreditReturned: true } },
    { new: true }
  );
  if (!session) return false;
  await returnCredit(session.clientPackage);
  return true;
};

// Create the client's package after a successful package payment; the first session uses a credit
export const createClientPackageFromPayment = async (payment, clientId, firstSessionDate) => {
  const { sessionCount, pricePerSession, validityDays } = payment.packagePurchase;
  const start = dateFromKey(toDateKey(payment.paidAt || new Date()));
  const expiresAt = new Date(start.getTime() + validityDays * DAY_MS);
  return ClientPackage.create({
    therapist: payment.therapist,
    client: clientId,
    package: payment.packagePurchase.package,
    payment: payment._id,
    sessionsTotal: sessionCount,
    sessionsUsed: firstSessionDate ? 1 : 0,
    pricePerSession,
    amountPaid: payment.amount,
    purchasedAt: payment.paidAt || new Date(),
    expiresAt,
  });
};

// The value of the sessions in a package that haven't been used (paise)
export const unusedValue = (cp) => Math.max(0, cp.sessionsTotal - cp.sessionsUsed) * cp.pricePerSession;

export const findClientPackages = (therapistId, clientId) =>
  ClientPackage.find({ therapist: therapistId, client: clientId }).sort({ purchasedAt: -1 });
