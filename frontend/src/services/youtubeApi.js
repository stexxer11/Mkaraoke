import api from "./api";

// =========================
// ADD SONG
// =========================

export const addSongApi = async (song) => {
  const res = await api.post("/song", song);
  return res.data;
};

// =========================
// EDIT SONG
// =========================

export const editSongApi = async (id, data) => {
  const res = await api.put(`/song/${id}`, data);
  return res.data;
};

// =========================
// CANCEL SONG
// =========================

export const cancelSongApi = async (id) => {
  const res = await api.post(`/song/${id}/cancel`);
  return res.data;
};

// =========================
// NEXT SONG
// =========================

export const nextSongApi = async () => {
  const res = await api.post("/next");
  return res.data;
};

// =========================
// PLAY NOW
// =========================

export const playNowApi = async (id) => {
  const res = await api.post(`/play-now/${id}`);
  return res.data;
};

// =========================
// REMOVE SONG (alias seguro)
// =========================

export const removeSongApi = async (id) => {
  const res = await api.post(`/song/${id}/cancel`);
  return res.data;
};