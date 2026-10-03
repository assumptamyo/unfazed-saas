import mongoose from "mongoose";

// One document per subscription tier. Everything that differs between tiers —
// price, caps and feature flags — lives here as data, so plans can be changed
// without touching code. Code never compares tier names; it asks the
// entitlement service instead.
const subscriptionTierConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    monthlyPrice: { type: Number, required: true, min: 0 }, // paise
    sortOrder: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false }, // tier given to new therapists
    limits: {
      activeClients: { type: Number, default: null }, // null = unlimited
    },
    features: {
      structuredNoteTemplates: { type: Boolean, default: false },
      advancedAnalytics: { type: Boolean, default: false },
      onlinePayments: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model("SubscriptionTierConfig", subscriptionTierConfigSchema);
