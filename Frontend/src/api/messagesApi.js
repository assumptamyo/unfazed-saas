import axiosInstance from "./axiosInstance";

export const getConversations = () => axiosInstance.get("/messages/conversations");
export const getUnreadCount = () => axiosInstance.get("/messages/unread-count");
export const getConversation = (clientId, before) =>
  axiosInstance.get(`/messages/${clientId}`, { params: before ? { before } : {} });
export const sendMessage = (clientId, text, sessionId) => axiosInstance.post(`/messages/${clientId}`, { text, sessionId });
export const markConversationRead = (clientId) => axiosInstance.post(`/messages/${clientId}/read`);

export const joinTherapistVideo = (sessionId) => axiosInstance.post(`/appointments/${sessionId}/video`);
export const sendPortalLink = (clientId) => axiosInstance.post(`/clients/${clientId}/portal-link`);
