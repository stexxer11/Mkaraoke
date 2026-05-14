import api from "./api"

// =========================
// SAFE REQUEST
// =========================
const safeRequest = async (
  request,
  name
) => {

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

    console.error(
      `API ERROR [${name}]`,
      {
        status,
        message,
      }
    )

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
  safeRequest(
    api.get("/queue"),
    "GET_QUEUE"
  )

export const addSongApi = (song) =>
  safeRequest(
    api.post("/queue/add", song),
    "ADD_SONG"
  )

export const editSongApi = (
  id,
  data
) =>
  safeRequest(
    api.put(`/queue/edit/${id}`, data),
    "EDIT_SONG"
  )

export const cancelSongApi = (id) =>
  safeRequest(
    api.put(`/queue/cancel/${id}`),
    "CANCEL_SONG"
  )

export const nextSongApi = () =>
  safeRequest(
    api.post("/queue/next"),
    "NEXT_SONG"
  )

export const playNowApi = (id) =>
  safeRequest(
    api.post(`/queue/playnow/${id}`),
    "PLAY_NOW"
  )

export const removeSongApi = (id) =>
  safeRequest(
    api.delete(`/queue/hard/${id}`),
    "REMOVE_SONG"
  )

// =========================
// USERS
// =========================

// obtener perfil actual
export const getUserApi = () =>
  safeRequest(
    api.get("/user/me"),
    "GET_USER"
  )

// crear perfil
export const createUserApi = (
  data
) =>
  safeRequest(
    api.post("/user", data),
    "CREATE_USER"
  )

// actualizar perfil
export const updateUserApi = (
  data
) =>
  safeRequest(
    api.put("/user/me", data),
    "UPDATE_USER"
  )

// eliminar perfil
export const deleteUserApi = () =>
  safeRequest(
    api.delete("/user/me"),
    "DELETE_USER"
  )