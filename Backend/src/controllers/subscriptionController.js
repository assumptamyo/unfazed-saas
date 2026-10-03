import Therapist from "../models/Therapist.js";
import {
  getTiers,
  getTierForTherapist,
  getEntitlements,
  canAccess,
  FEATURES,
} from "../services/entitlementService.js";

// @desc   What the logged-in therapist can use right now (drives the frontend's useEntitlement hook)
// @route  GET /api/subscription/entitlements
export const getMyEntitlements = async (req, res) => {
  try {
    return res.status(200).json(await getEntitlements(req.therapist));
  } catch (error) {
    console.error("Entitlements error:", error.message);
    return res.status(500).json({ message: "Server error while loading your plan" });
  }
};

// @desc   All tiers with their prices and features, plus the therapist's current tier and usage
// @route  GET /api/subscription
export const getPlans = async (req, res) => {
  try {
    const [tiers, current, entitlements] = await Promise.all([
      getTiers(),
      getTierForTherapist(req.therapist),
      getEntitlements(req.therapist),
    ]);

    const featureList = Object.entries(FEATURES).map(([key, f]) => ({ key, label: f.label, type: f.type, field: f.field }));

    return res.status(200).json({
      currentTier: current.key,
      usage: { activeClients: entitlements.features["clients.active"].usage },
      features: featureList,
      tiers: tiers.map((t) => ({
        key: t.key,
        name: t.name,
        description: t.description,
        monthlyPrice: t.monthlyPrice,
        limits: t.limits,
        features: t.features,
      })),
    });
  } catch (error) {
    console.error("Plans error:", error.message);
    return res.status(500).json({ message: "Server error while loading plans" });
  }
};

// @desc   Switch plan. In this project the switch is immediate (no subscription billing);
//         charging therapists would be added here, e.g. with Razorpay Subscriptions.
// @route  POST /api/subscription/change
export const changePlan = async (req, res) => {
  try {
    const tiers = await getTiers();
    const target = tiers.find((t) => t.key === req.body.tierKey);
    if (!target) {
      return res.status(400).json({ message: "Unknown plan" });
    }

    // Moving to a plan with a lower client cap is blocked while over that cap
    const active = (await canAccess(req.therapist, "clients.active")).usage;
    const cap = target.limits?.activeClients ?? null;
    if (cap !== null && active > cap) {
      return res.status(400).json({
        message: `You have ${active} active clients, but ${target.name} allows ${cap}. Archive some clients first.`,
      });
    }

    const therapist = await Therapist.findByIdAndUpdate(
      req.therapist._id,
      { subscriptionTier: target.key },
      { new: true }
    );

    // If the new plan doesn't include online payments, stop charging clients
    let feeReset = false;
    if (therapist.sessionFee > 0 && !(await canAccess(therapist, "payments.online")).allowed) {
      therapist.sessionFee = 0;
      await therapist.save();
      feeReset = true;
    }

    return res.status(200).json({
      message: `You're now on ${target.name}`,
      feeReset,
      ...(await getEntitlements(therapist)),
    });
  } catch (error) {
    console.error("Change plan error:", error.message);
    return res.status(500).json({ message: "Server error while changing plan" });
  }
};
