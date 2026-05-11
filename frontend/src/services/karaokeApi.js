import api from "./api"

// =========================
// GET QUEUE
// =========================

export const getQueue = async () => {

  const res = await api.get("/queue")

  return res.data
}

// =========================
// ADD SONG
// =========================

export const addSongApi = async (song) => {

  const res = await api.post(
    "/queue/add",
    song
  )

  return res.data
}

// =========================
// EDIT SONG
// =========================

export const editSongApi = async (
  id,
  data
) => {

  const res = await api.put(
    `/queue/edit/${id}`,
    data
  )

  return res.data
}

// =========================
// CANCEL SONG
// =========================

export const cancelSongApi = async (
  id
) => {

  const res = await api.put(
    `/queue/cancel/${id}`
  )

  return res.data
}

// =========================
// NEXT SONG
// =========================

export const nextSongApi = async () => {

  const res = await api.post(
    "/queue/next"
  )

  return res.data
}

// =========================
// PLAY NOW
// =========================

export const playNowApi = async (
  id
) => {

  const res = await api.post(
    `/queue/playnow/${id}`
  )

  return res.data
}

// =========================
// REMOVE SONG
// =========================

export const removeSongApi = async (
  id
) => {

  const res = await api.delete(
    `/queue/remove/${id}`
  )

  return res.data
}