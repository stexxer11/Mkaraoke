import { api } from "./api"
import { safeRequest } from "./safeRequest"

/* =========================
   QUEUE
========================= */

export const getQueue = async () =>
  safeRequest(api.get("/queue/state"), "GET_QUEUE")

export const addSongApi = async (song) =>
  safeRequest(api.post("/queue/add", song), "ADD_SONG")

export const editSongApi = async (id, data) => {
  if (!id) throw new Error("EDIT_SONG: MISSING_ID")

  return safeRequest(
    api.put(`/queue/edit/${id}`, data),
    "EDIT_SONG"
  )
}

export const cancelSongApi = async (id) => {
  if (!id) throw new Error("CANCEL_SONG: MISSING_ID")

  return safeRequest(
    api.put(`/queue/cancel/${id}`),
    "CANCEL_SONG"
  )
}

export const nextSongApi = async () =>
  safeRequest(api.post("/queue/next"), "NEXT_SONG")

export const playNowApi = async (id) => {
  if (!id) throw new Error("PLAY_NOW: MISSING_ID")

  return safeRequest(
    api.post(`/queue/playnow/${id}`),
    "PLAY_NOW"
  )
}

/* =========================
   USERS (SIN SUPABASE DIRECTO)
========================= */

export const registerUserApi = async (deviceId, name) => {
  return safeRequest(
    api.post("/users/register", {
      deviceId,
      name,
    }),
    "REGISTER_USER"
  )
}