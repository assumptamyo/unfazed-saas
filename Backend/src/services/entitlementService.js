import SubscriptionTierConfig from "../models/SubscriptionTierConfig.js";
import Therapist from "../models/Therapist.js";
import Client from "../models/Client.js";
import defaultTiers from "../config/subscriptionTiers.js";

// The single source of truth for "is this therapist allowed to do X?".
// Routes and controllers call canAccess(therapistId, featureKey) and never look
// at tier names themselves, so plans can change without code changes.

// Every gated feature is described once, here.
//   type "flag"  -> on/off per tier (tier.features[field])
//   type "limit" -> a numeric cap per tier (tier.limits[field]); usage() counts current use
export const FEATURES = {
  "clients.active": {
    type: "limit",
    field: "activeClients",
    label: "Active clients",
    usage: (therapistId) => Client.countDocuments({ therapist: therapistId, archivedAt: null }),
    blockedMessage: (limit) =>
      `Your plan includes up to ${limit} active clients. Upgrade to add more, or archive a client you no longer see.`,
  },
  "notes.structuredTemplates": {
    type: "flag",
    field: "structuredNoteTemplates",
    label: "SOAP & DAP note templates",
    blockedMessage: () => "SOAP and DAP note templates are available on paid plans. Free write is always included.",
  },
  "analytics.advanced": {
    type: "flag",
    field: "advancedAnalytics",
    label: "Advanced analytics",
    blockedMessage: () => "Revenue trends, no-show rates and client trends are available on paid plans.",
  },
  "payments.online": {
    type: "flag",
    field: "onlinePayments",
    label: "Online payments at booking",
    blockedMessage: () => "Taking payment when clients book is available on paid plans.",
  },
};

// Tier configs change rarely, so cache them briefly instead of reading the database on every request
const CACHE_MS = 60 * 1000;
let cache = { tiers: null, at: 0 };

export const getTiers = async () => {
  if (cache.tiers && Date.now() - cache.at < CACHE_MS) return cache.tiers;
  const tiers = await SubscriptionTierConfig.find().sort({ sortOrder: 1 }).lean();
  cache = { tiers, at: Date.now() };
  return tiers;
};

export const clearTierCache = () => {
  cache = { tiers: null, at: 0 };
};

// Insert the starting configuration the first time the server runs
export const seedTiersIfEmpty = async () => {
  if ((await SubscriptionTierConfig.estimatedDocumentCount()) > 0) return;
  await SubscriptionTierConfig.insertMany(defaultTiers);
  clearTierCache();
  console.log("Subscription tiers seeded");
};

const defaultTier = (tiers) => tiers.find((t) => t.isDefault) || tiers[0];

// The tier a therapist is on; therapists without one get the default tier
export const getTierForTherapist = async (therapistOrId) => {
  const therapist =
    therapistOrId?.subscriptionTier !== undefined
      ? therapistOrId
      : await Therapist.findById(therapistOrId?._id || therapistOrId).select("subscriptionTier").lean();
  const tiers = await getTiers();
  return tiers.find((t) => t.key === therapist?.subscriptionTier) || defaultTier(tiers);
};

// Cheapest tier (by sortOrder) that unlocks a feature / raises a limit above `needed`
const upgradeOptionFor = (tiers, current, feature, needed = 0) =>
  tiers.find(
    (t) =>
      t.sortOrder > current.sortOrder &&
      (feature.type === "flag"
        ? t.features?.[feature.field] === true
        : t.limits?.[feature.field] === null || t.limits?.[feature.field] > needed)
  ) || null;

/**
 * Can this therapist use a feature?
 *   canAccess(therapistId, "notes.structuredTemplates")
 *   canAccess(therapistId, "clients.active", { adding: 1 })   // would one more fit?
 * Returns { allowed, featureKey, tier, limit?, usage?, message?, upgradeTo? }
 */
export const canAccess = async (therapistOrId, featureKey, { adding = 0 } = {}) => {
  const feature = FEATURES[featureKey];
  if (!feature) throw new Error(`Unknown feature key: ${featureKey}`);

  const therapistId = therapistOrId?._id || therapistOrId;
  const tiers = await getTiers();
  const tier = await getTierForTherapist(therapistOrId);
  const result = { featureKey, tier: { key: tier.key, name: tier.name } };

  if (feature.type === "flag") {
    result.allowed = tier.features?.[feature.field] === true;
  } else {
    const limit = tier.limits?.[feature.field] ?? null;
    const usage = await feature.usage(therapistId);
    result.limit = limit;
    result.usage = usage;
    result.allowed = limit === null || usage + adding <= limit;
  }

  if (!result.allowed) {
    result.message = feature.blockedMessage(result.limit);
    const next = upgradeOptionFor(tiers, tier, feature, (result.usage || 0) + adding - 1);
    result.upgradeTo = next ? { key: next.key, name: next.name, monthlyPrice: next.monthlyPrice } : null;
  }
  return result;
};

// Every feature's status at once, for the frontend
export const getEntitlements = async (therapistOrId) => {
  const tier = await getTierForTherapist(therapistOrId);
  const entries = await Promise.all(
    Object.keys(FEATURES).map(async (key) => [key, await canAccess(therapistOrId, key)])
  );
  return { tier: { key: tier.key, name: tier.name }, features: Object.fromEntries(entries) };
};

// Standard 403 body for a blocked action; the frontend shows its upgrade prompt for this code
export const upgradeRequired = (res, access) =>
  res.status(403).json({
    code: "UPGRADE_REQUIRED",
    message: access.message,
    featureKey: access.featureKey,
    tier: access.tier,
    limit: access.limit,
    usage: access.usage,
    upgradeTo: access.upgradeTo,
  });
