import api from "./api"
import { safeRequest } from "./safeRequest"
// =========================
// SAFE REQUEST WRAPPER
// =========================

const safeRequest = async (promise, name) => {
  try {
    const res = await promise

    if (!res) {
      throw new Error(`${name}: NO_RESPONSE`)
    }

    if (res.data === undefined || res.data === null) {
      throw new Error(`${name}: EMPTY_DATA`)
    }

    return res.data

  } catch (err) {
    const backendError = err?.response?.data
    const message = backendError?.detail || err.message || "UNKNOWN_ERROR"

    console.error(`API ERROR [${name}]`, message)

    throw new Error(message)
  }
}

// =========================
// GET QUEUE
// =========================

export const getQueue = async () => {
  return safeRequest(api.get("/queue"), "GET_QUEUE")
}

// =========================
// ADD SONG
// =========================

export const addSongApi = async (song) => {
  return safeRequest(
    api.post("/queue/add", song),
    "ADD_SONG"
  )
}

// =========================
// EDIT SONG
// =========================

export const editSongApi = async (id, data) => {
  if (!id) throw new Error("EDIT_SONG: MISSING_ID")

  return safeRequest(
    api.put(`/queue/edit/${id}`, data),
    "EDIT_SONG"
  )
}

// =========================
// CANCEL SONG
// =========================

export const cancelSongApi = async (id) => {
  if (!id) throw new Error("CANCEL_SONG: MISSING_ID")

  return safeRequest(
    api.put(`/queue/cancel/${id}`),
    "CANCEL_SONG"
  )
}

// =========================
// NEXT SONG
// =========================

export const nextSongApi = async () => {
  return safeRequest(
    api.post("/queue/next"),
    "NEXT_SONG"
  )
}

// =========================
// PLAY NOW
// =========================

export const playNowApi = async (id) => {
  if (!id) throw new Error("PLAY_NOW: MISSING_ID")

  return safeRequest(
    api.post(`/queue/playnow/${id}`),
    "PLAY_NOW"
  )
}

// =========================
// REMOVE SONG
// =========================

export const removeSongApi = async (id) => {
  if (!id) throw new Error("REMOVE_SONG: MISSING_ID")

  return safeRequest(
    api.delete(`/queue/remove/${id}`),
    "REMOVE_SONG"
  )
}

export const registerUserApi = async (deviceId, name) => {
  return safeRequest(
    api.post("/users/register", {
      deviceId,
      name
    }),
    "REGISTER_USER"
  )
}