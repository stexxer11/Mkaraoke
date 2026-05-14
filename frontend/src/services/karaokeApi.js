import api from "./api"

// =========================
// SAFE REQUEST
// =========================
const safeRequest = async (request, name) => {
  try {
    const response = await request

    if (!response) {
      throw new Error(`${name}: NO_RESPONSE`)
    }

    return response.data

  } catch (error) {
    const status =
      error?.response?.status

    const serverMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message

    const message =
      serverMessage ||
      error?.message ||
      "UNKNOWN_ERROR"

    console.error(`API ERROR [${name}]`, {
      status,
      message,
    })

    throw {
      status,
      message,
      original: error
    }
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
// USERS (FIXED)
// =========================

// ❌ NO /user/me
export const getUserApi = (userId) =>
  safeRequest(api.get(`/user/${userId}`), "GET_USER")

export const createUserApi = (data) =>
  safeRequest(api.post("/user", data), "CREATE_USER")