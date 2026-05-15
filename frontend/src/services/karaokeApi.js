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

//
// =========================
// QUEUE API
// =========================
//

export const getQueueApi = () =>
  safeRequest(api.get("/queue?select=*&order=created_at.asc"), "GET_QUEUE")

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

//
// =========================
// PROFILES API (ÚNICO USUARIO SYSTEM)
// =========================
//

export const getProfileApi = async (userId) => {
  const data = await safeRequest(
    api.get(`/profiles?id=eq.${userId}`),
    "GET_PROFILE"
  )

  // Supabase devuelve array
  return data?.[0] ?? null
}

export const createProfileApi = async (data) => {
  const res = await safeRequest(
    api.post("/profiles", {
      id: data.id,
      artist_name: data.artistName,
    }),
    "CREATE_PROFILE"
  )

  return res?.[0] ?? res
}

export const updateProfileApi = async (id, data) => {
  const res = await safeRequest(
    api.patch(`/profiles?id=eq.${id}`, {
      artist_name: data.artistName,
    }),
    "UPDATE_PROFILE"
  )

  return res?.[0] ?? res
}