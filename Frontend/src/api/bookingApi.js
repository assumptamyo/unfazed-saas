import axiosInstance from "./axiosInstance";

export const getTherapistSlots = (slug, days = 14) =>
  axiosInstance.get(`/therapist/${slug}/slots?days=${days}`);

export const bookSession = (slug, data) =>
  axiosInstance.post(`/therapist/${slug}/book`, data);