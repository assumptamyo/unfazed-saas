import { canAccess, upgradeRequired } from "../services/entitlementService.js";

// Route-level gate: router.get("/x", authMiddleware, requireFeature("analytics.advanced"), handler)
// For checks that depend on the request body (e.g. which note template), controllers
// call canAccess() directly instead.
const requireFeature = (featureKey) => async (req, res, next) => {
  try {
    const access = await canAccess(req.therapist, featureKey);
    if (!access.allowed) return upgradeRequired(res, access);
    req.entitlement = access;
    next();
  } catch (error) {
    next(error);
  }
};

export default requireFeature;
