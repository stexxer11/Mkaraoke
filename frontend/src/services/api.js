import axios from "axios"
import { createClient } from "@supabase/supabase-js"

/* =========================
   AXIOS (FastAPI backend)
========================= */

const baseURL = import.meta.env.VITE_API_URL

if (!baseURL) {
  console.warn("VITE_API_URL no está definida")
}

export const api = axios.create({
  baseURL: baseURL || "",
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
   SUPABASE CLIENT (SAFE)
========================= */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase env missing")
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null