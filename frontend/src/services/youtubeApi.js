import api from "./api";

// =========================
// GET QUEUE
// =========================

export const getQueue = async () => {
  const res = await api.get("/queue");
  return res.data;
};

// =========================
// ADD SONG (BACKEND: /song)
// =========================

export const addSongApi = async (song) => {
  const res = await api.post("/song", song);
  return res.data;
};

// =========================
// EDIT SONG (BACKEND: /song/:id)
// =========================

export const editSongApi = async (id, data) => {
  const res = await api.put(`/song/${id}`, data);
  return res.data;
};

// =========================
// CANCEL SONG (BACKEND: /song/:id/cancel)
// =========================

export const cancelSongApi = async (id) => {
  const res = await api.post(`/song/${id}/cancel`);
  return res.data;
};

// =========================
// NEXT SONG (BACKEND: /next)
// =========================

export const nextSongApi = async () => {
  const res = await api.post("/next");
  return res.data;
};

// =========================
// PLAY NOW (BACKEND: /play-now/:id)
// =========================

export const playNowApi = async (id) => {
  const res = await api.post(`/play-now/${id}`);
  return res.data;
};

// =========================
// REMOVE SONG (NO EXISTE EN BACKEND ACTUAL)
// =========================

export const removeSongApi = async (id) => {
  // equivalente seguro
  const res = await api.post(`/song/${id}/cancel`);
  return res.data;
};