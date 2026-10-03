import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The server answers 403 { code: "UPGRADE_REQUIRED" } when a plan doesn't include a feature.
// Announce it once here so a single upgrade prompt can handle every page.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    if (error.response?.status === 403 && data?.code === "UPGRADE_REQUIRED") {
      error.upgradeHandled = true;
      window.dispatchEvent(new CustomEvent("unfazed:upgrade-required", { detail: data }));
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;