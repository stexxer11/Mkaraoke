import api from "./api"

// =========================
// SAFE REQUEST
// =========================
const safeRequest = async (request, name) => {
  try {
    const response = await request

    if (!response?.data) {
      throw new Error(`${name}: EMPTY_RESPONSE`)
    }

    return response.data

  } catch (error) {
    const status = error?.response?.status

    const message =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "UNKNOWN_ERROR"

    console.error(`API ERROR [${name}]`, { status, message })

    throw { status, message, original: error }
  }
}

// =========================
// QUEUE
// =========================
export const getQueue = () =>
  safeRequest(api.get("/queue"), "GET_QUEUE")

export const addSongApi = (song) =>
  safeRequest(api.post("/queue/add", song), "ADD_SONG")

export const editSongApi = (id, data) =>
  safeRequest(api.put(`/queue/edit/${id}`, data), "EDIT_SONG")

export const cancelSongApi = (id) =>
  safeRequest(api.put(`/queue/cancel/${id}`), "CANCEL_SONG")

export const nextSongApi = () =>
  safeRequest(api.post("/queue/next"), "NEXT_SONG")

export const playNowApi = (id) =>
  safeRequest(api.post(`/queue/playnow/${id}`), "PLAY_NOW")

export const removeSongApi = (id) =>
  safeRequest(api.delete(`/queue/hard/${id}`), "REMOVE_SONG")

// =========================
// USERS (NORMALIZADO)
// =========================

export const getUserApi = async (userId) => {
  const data = await safeRequest(
    api.get(`/user/${userId}`),
    "GET_USER"
  )

  return normalizeUser(data)
}

export const createUserApi = async (data) => {
  const res = await safeRequest(
    api.post("/user", data),
    "CREATE_USER"
  )

  return normalizeUser(res)
}

// =========================
// NORMALIZER (🔥 CRÍTICO)
// =========================
const normalizeUser = (user) => {
  if (!user) return null

  return {
    id: user.id,
    artist_name: user.artist_name ?? user.artistName ?? null,
  }
}