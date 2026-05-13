import api from "./api"

// =========================
// SAFE WRAPPER
// =========================

const safeRequest = async (promise, name) => {
  try {
    const res = await promise

    if (!res) throw new Error(`${name}: NO_RESPONSE`)
    if (res.data === undefined) throw new Error(`${name}: EMPTY_DATA`)

    return res.data

  } catch (err) {
    const message =
      err?.response?.data?.detail ||
      err.message ||
      "UNKNOWN_ERROR"

    console.error(`API ERROR [${name}]`, message)
    throw new Error(message)
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
// 🆕 USERS (AQUÍ TODO JUNTO)
// =========================


export const getUserApi = async (id) =>
  safeRequest(api.get(`/user/${id}`), "GET_USER")

export const createUserApi = async (data) =>
  safeRequest(api.post(`/user`, data), "CREATE_USER")