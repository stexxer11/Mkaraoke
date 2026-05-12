import axios from "axios"
import api from "./api"

const API_URL = "https://mkaraoke-1.onrender.com"

// =========================
// SEARCH YOUTUBE
// =========================

export const searchYouTube = async (query) => {
  if (!query) return []

  try {
    const res = await axios.get(`${API_URL}/search`, {
      params: { q: query }
    })

    return res.data

  } catch (err) {
    console.log(err)
    return []
  }
}

// =========================
// ADD SONG
// =========================

export const addSongApi = async (song) => {
  const res = await api.post("/song", song)
  return res.data
}

// =========================
// EDIT SONG
// =========================

export const editSongApi = async (id, data) => {
  const res = await api.put(`/song/${id}`, data)
  return res.data
}

// =========================
// CANCEL SONG
// =========================

export const cancelSongApi = async (id) => {
  const res = await api.post(`/song/${id}/cancel`)
  return res.data
}

// =========================
// NEXT SONG
// =========================

export const nextSongApi = async () => {
  const res = await api.post("/next")
  return res.data
}

// =========================
// PLAY NOW
// =========================

export const playNowApi = async (id) => {
  const res = await api.post(`/play-now/${id}`)
  return res.data
}

// =========================
// REMOVE SONG
// =========================

export const removeSongApi = async (id) => {
  const res = await api.post(`/song/${id}/cancel`)
  return res.data
}