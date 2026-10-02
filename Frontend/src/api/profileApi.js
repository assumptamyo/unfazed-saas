import axiosInstance from "./axiosInstance";

export const updateProfile = (data) => axiosInstance.put("/therapist/me", data);
export const getMyProfile = () => axiosInstance.get("/therapist/me");

export const uploadPhoto = (file) => {
  const formData = new FormData();
  formData.append("photo", file);
  return axiosInstance.post("/therapist/upload-photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};