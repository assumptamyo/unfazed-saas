import axiosInstance from "./axiosInstance";

export const getEntitlements = () => axiosInstance.get("/subscription/entitlements");
export const getPlans = () => axiosInstance.get("/subscription");
export const changePlan = (tierKey) => axiosInstance.post("/subscription/change", { tierKey });

export const getAnalyticsOverview = () => axiosInstance.get("/analytics/overview");
export const getAnalyticsAdvanced = (months = 6) => axiosInstance.get("/analytics/advanced", { params: { months } });
