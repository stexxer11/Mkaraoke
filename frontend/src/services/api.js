import axios from "axios"
import { createClient } from "@supabase/supabase-js"

/* =========================
   AXIOS (tu backend FastAPI)
========================= */

const baseURL = import.meta.env.VITE_API_URL

if (!baseURL) {
  throw new Error("VITE_API_URL no está definida en las variables de entorno")
}

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.data || error.message)
    return Promise.reject(error)
  }
)

/* =========================
   SUPABASE CLIENT
========================= */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de entorno de Supabase (VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY)"
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)