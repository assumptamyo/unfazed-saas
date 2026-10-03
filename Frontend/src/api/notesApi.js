import axiosInstance from "./axiosInstance";

export const getNotes = (params = {}) => axiosInstance.get("/notes", { params });
export const getPendingNotes = () => axiosInstance.get("/notes/pending");
// visibility: "private" (clinical record) or "shared" (shown to the client once signed)
export const getNoteForSession = (sessionId, visibility = "private") =>
  axiosInstance.get(`/notes/session/${sessionId}`, { params: { visibility } });
export const saveNoteDraft = (sessionId, data) => axiosInstance.put(`/notes/session/${sessionId}`, data);
export const signNote = (id) => axiosInstance.post(`/notes/${id}/sign`);
export const addNoteAddendum = (id, text) => axiosInstance.post(`/notes/${id}/addenda`, { text });
export const deleteNoteDraft = (id) => axiosInstance.delete(`/notes/${id}`);
