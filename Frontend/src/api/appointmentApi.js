import axiosInstance from "./axiosInstance";

export const getAppointments = (params = {}) => axiosInstance.get("/appointments", { params });

export const getAppointmentById = (id) => axiosInstance.get(`/appointments/${id}`);

export const getRescheduleSlots = (excludeId, days = 30) =>
  axiosInstance.get("/appointments/available-slots", { params: { exclude: excludeId, days } });

export const updateAppointmentStatus = (id, status) =>
  axiosInstance.patch(`/appointments/${id}/status`, { status });

export const cancelAppointment = (id, data) => axiosInstance.post(`/appointments/${id}/cancel`, data);

export const rescheduleAppointment = (id, data) =>
  axiosInstance.post(`/appointments/${id}/reschedule`, data);
