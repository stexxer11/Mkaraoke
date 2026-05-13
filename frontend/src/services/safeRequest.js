export const safeRequest = async (promise, name) => {
  try {
    const res = await promise

    if (!res || !res.data) {
      throw new Error(`${name}: EMPTY_RESPONSE`)
    }

    return res.data
  } catch (err) {
    console.error(`[${name}] ERROR:`, err)

    const message =
      err?.response?.data?.detail ||
      err?.message ||
      "UNKNOWN_ERROR"

    throw new Error(message)
  }
}