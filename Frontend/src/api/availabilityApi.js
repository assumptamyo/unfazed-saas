import axiosInstance from "./axiosInstance";

export const setAvailability = (data) => axiosInstance.post("/availability", data);
export const getMyAvailability = () => axiosInstance.get("/availability");
export const deleteAvailability = (dayOfWeek) => axiosInstance.delete(`/availability/${dayOfWeek}`);
export const createOverride = (data) => axiosInstance.post("/availability/override", data);
export const getMyOverrides = () => axiosInstance.get("/availability/override");
export const deleteOverride = (id) => axiosInstance.delete(`/availability/override/${id}`);