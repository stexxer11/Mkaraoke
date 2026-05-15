import api from "./api"

// =========================
// SAFE REQUEST (ROBUSTO)
// =========================
const safeRequest = async (request, name) => {
  try {
    const response = await request

    const data = response?.data ?? response

    if (!data) {
      throw new Error(`${name}: EMPTY_RESPONSE`)
    }

    return data

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
  safeRequest(
    api.post("/queue/add", {
      owner_id: song.ownerId,
      title: song.title,
      artist: song.artist,
      youtube_id: song.youtubeId,
    }),
    "ADD_SONG"
  )

export const editSongApi = (id, data) =>
  safeRequest(
    api.put(`/queue/edit/${id}`, {
      title: data.title,
      artist: data.artist,
      youtube_id: data.youtubeId,
    }),
    "EDIT_SONG"
  )

export const cancelSongApi = (id) =>
  safeRequest(api.put(`/queue/cancel/${id}`), "CANCEL_SONG")

export const nextSongApi = () =>
  safeRequest(api.post("/queue/next"), "NEXT_SONG")

export const playNowApi = (id) =>
  safeRequest(api.post(`/queue/playnow/${id}`), "PLAY_NOW")

export const removeSongApi = (id) =>
  safeRequest(api.delete(`/queue/hard/${id}`), "REMOVE_SONG")

// =========================
// USERS
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
    api.post("/user", {
      id: data.id,
      artist_name: data.artistName
    }),
    "CREATE_USER"
  )

  return normalizeUser(res)
}

// =========================
// NORMALIZER
// =========================
const normalizeUser = (user) => {
  if (!user) return null

  return {
    id: user.id,
    artist_name: user.artist_name ?? user.artistName ?? null,
  }
}
