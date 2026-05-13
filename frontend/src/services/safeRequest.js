export const safeRequest = async (promise, name) => {
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