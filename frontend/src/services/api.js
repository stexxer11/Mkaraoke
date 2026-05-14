import axios from "axios"

const baseURL = import.meta.env.VITE_API_URL

if (!baseURL) {
  throw new Error("VITE_API_URL no está definida")
}

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
})

export default api