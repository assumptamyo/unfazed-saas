import { createContext, useContext } from "react";

export const EntitlementContext = createContext({
  tier: null,
  features: {},
  can: () => true,
  feature: () => null,
  refresh: () => {},
  promptUpgrade: () => {},
});

// const { can, promptUpgrade } = useEntitlement();
// if (!can("notes.structuredTemplates")) promptUpgrade("notes.structuredTemplates");
export const useEntitlement = () => useContext(EntitlementContext);

// Fired by the API layer whenever the server answers 403 UPGRADE_REQUIRED
export const UPGRADE_EVENT = "unfazed:upgrade-required";
