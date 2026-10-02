import axiosInstance from "./axiosInstance";

export const getClients = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return axiosInstance.get(`/clients${query ? `?${query}` : ""}`);
};

export const getClientById = (id) => axiosInstance.get(`/clients/${id}`);

export const updateClient = (id, data) => axiosInstance.put(`/clients/${id}`, data);