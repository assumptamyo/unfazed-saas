import axiosInstance from "./axiosInstance";

export const getNotifications = () => axiosInstance.get("/notifications");
export const markAllNotificationsRead = () => axiosInstance.post("/notifications/read-all");
export const markNotificationRead = (id) => axiosInstance.post(`/notifications/${id}/read`);
export const getNotificationLog = (channel) =>
  axiosInstance.get("/notifications/log", { params: channel ? { channel } : {} });
