import axios from "axios"

const baseURL = import.meta.env.VITE_API_URL

if (!baseURL) {
  throw new Error("VITE_API_URL no está definida en las variables de entorno")
}

const api = axios.create({
  baseURL,
  timeout: 15000,
})

export default api