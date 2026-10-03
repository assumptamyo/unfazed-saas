// Initial tier configuration, inserted into the SubscriptionTierConfig collection
// the first time the server starts with an empty collection. After that the
// database is the source of truth: edit the documents there to change plans.
const defaultTiers = [
  {
    key: "starter",
    name: "Starter",
    description: "For therapists getting their practice online.",
    monthlyPrice: 0,
    sortOrder: 1,
    isDefault: true,
    limits: { activeClients: 5 },
    features: { structuredNoteTemplates: false, advancedAnalytics: false, onlinePayments: false },
  },
  {
    key: "professional",
    name: "Professional",
    description: "For a growing private practice.",
    monthlyPrice: 99900,
    sortOrder: 2,
    limits: { activeClients: 50 },
    features: { structuredNoteTemplates: true, advancedAnalytics: true, onlinePayments: true },
  },
  {
    key: "practice",
    name: "Practice",
    description: "For full-time practices with a large caseload.",
    monthlyPrice: 249900,
    sortOrder: 3,
    limits: { activeClients: null },
    features: { structuredNoteTemplates: true, advancedAnalytics: true, onlinePayments: true },
  },
];

export default defaultTiers;
