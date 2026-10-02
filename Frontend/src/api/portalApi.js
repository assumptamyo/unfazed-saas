import axios from "axios";

// The client space uses its own login token, kept separate from the therapist's
export const CLIENT_TOKEN_KEY = "clientToken";

export const getClientToken = () => {
  try {
    return localStorage.getItem(CLIENT_TOKEN_KEY);
  } catch {
    return null;
  }
};

const portalAxios = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

portalAxios.interceptors.request.use((config) => {
  const token = getClientToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const startPortalSession = async (linkToken) => {
  const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/portal/session`, { token: linkToken });
  localStorage.setItem(CLIENT_TOKEN_KEY, res.data.token);
  return res.data;
};

export const leavePortal = () => localStorage.removeItem(CLIENT_TOKEN_KEY);

export const getPortal = () => portalAxios.get("/portal/me");
export const joinPortalVideo = (sessionId) => portalAxios.post(`/portal/sessions/${sessionId}/video`);
export const getPortalMessages = (before) => portalAxios.get("/portal/messages", { params: before ? { before } : {} });
export const sendPortalMessage = (text, sessionId) => portalAxios.post("/portal/messages", { text, sessionId });
export const markPortalRead = () => portalAxios.post("/portal/messages/read");

// Sign in with a code sent to the client's email
export const requestLoginCode = (email) =>
  axios.post(`${import.meta.env.VITE_API_BASE_URL}/portal/login/request`, { email });
export const verifyLoginCode = (email, code) =>
  axios.post(`${import.meta.env.VITE_API_BASE_URL}/portal/login/verify`, { email, code });
export const saveClientToken = (token) => localStorage.setItem(CLIENT_TOKEN_KEY, token);
