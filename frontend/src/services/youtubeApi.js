import axios from "axios"

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
  const res = await axios.post(`${API_URL}/queue/add`, song)
  return res.data
}

// =========================
// NEXT SONG
// =========================

export const nextSongApi = async () => {
  const res = await axios.post(`${API_URL}/queue/next`)
  return res.data
}

// =========================
// PLAY NOW
// =========================

export const playNowApi = async (id) => {
  const res = await axios.post(`${API_URL}/queue/playnow/${id}`)
  return res.data
}

// =========================
// REMOVE SONG
// =========================

export const removeSongApi = async (id) => {
  const res = await axios.delete(`${API_URL}/queue/remove/${id}`)
  return res.data
}