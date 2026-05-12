import api from "./api"

// =========================
// SAFE REQUEST WRAPPER
// =========================

const safeRequest = async (promise, name) => {
  try {

    const res = await promise

    if (!res || !res.data) {
      throw new Error(`${name}: EMPTY_RESPONSE`)
    }

    return res.data

  } catch (err) {

    console.error(
      `API ERROR [${name}]`,
      err?.response?.data || err.message
    )

    throw err
  }
}

// =========================
// GET QUEUE
// =========================

export const getQueue = async () => {
  return safeRequest(
    api.get("/queue"),
    "GET_QUEUE"
  )
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

  if (!id) {
    throw new Error("EDIT_SONG: MISSING_ID")
  }

  return safeRequest(
    api.put(`/queue/edit/${id}`, data),
    "EDIT_SONG"
  )
}

// =========================
// CANCEL SONG
// =========================

export const cancelSongApi = async (id) => {

  if (!id) {
    throw new Error("CANCEL_SONG: MISSING_ID")
  }

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

  if (!id) {
    throw new Error("PLAY_NOW: MISSING_ID")
  }

  return safeRequest(
    api.post(`/queue/playnow/${id}`),
    "PLAY_NOW"
  )
}

// =========================
// REMOVE SONG
// =========================

export const removeSongApi = async (id) => {

  if (!id) {
    throw new Error("REMOVE_SONG: MISSING_ID")
  }

  return safeRequest(
    api.delete(`/queue/remove/${id}`),
    "REMOVE_SONG"
  )
}

// =========================
// REPEAT SONG
// =========================

export const repeatSongApi = async (song) => {

  if (!song) {
    throw new Error("REPEAT_SONG: MISSING_SONG")
  }

  return safeRequest(
    api.post("/queue/repeat", {
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId,
      ownerId: song.ownerId || "system",
    }),
    "REPEAT_SONG"
  )
}

// =========================
// REORDER QUEUE
// =========================

export const reorderQueueApi = async (queue) => {

  if (!Array.isArray(queue)) {
    throw new Error("REORDER_QUEUE: INVALID_QUEUE")
  }

  return safeRequest(
    api.put("/queue/reorder", {
      queue,
    }),
    "REORDER_QUEUE"
  )
}

// =========================
// RESTART CURRENT SONG
// =========================

export const restartSongApi = async (id) => {

  if (!id) {
    throw new Error("RESTART_SONG: MISSING_ID")
  }

  return safeRequest(
    api.post(`/queue/restart/${id}`),
    "RESTART_SONG"
  )
}