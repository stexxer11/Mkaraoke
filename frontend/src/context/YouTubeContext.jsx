import { createContext, useContext, useState, useRef } from "react"
import { searchYouTube } from "../services/youtubeApi"

const YouTubeContext = createContext()

export function YouTubeProvider({ children }) {

  // =========================
  // STATE
  // =========================
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  // =========================
  // CONTROL DE REQUESTS (FIX IMPORTANTE)
  // =========================
  const abortRef = useRef(null)

  // =========================
  // SEARCH SONGS
  // =========================
  const searchSongs = async (query) => {

    if (!query || query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    // cancelar request anterior si existe
    if (abortRef.current) {
      abortRef.current.cancelled = true
    }

    const request = { cancelled: false }
    abortRef.current = request

    setLoading(true)
    setResults([])

    try {

      const data = await searchYouTube(query)

      // evita race condition
      if (request.cancelled) return

      if (Array.isArray(data)) {
        setResults(data)
      } else {
        setResults([])
      }

    } catch (err) {

      if (!request.cancelled) {
        console.error("YouTube Search Error:", err)
        setResults([])
      }

    } finally {

      if (!request.cancelled) {
        setLoading(false)
      }

    }
  }

  // =========================
  // PROVIDER
  // =========================
  return (
    <YouTubeContext.Provider value={{
      results,
      loading,
      searchSongs,
    }}>
      {children}
    </YouTubeContext.Provider>
  )
}

// =========================
// SAFE HOOK (FIX IMPORTANTE)
// =========================
export function useYouTube() {
  const context = useContext(YouTubeContext)

  if (!context) {
    throw new Error("useYouTube must be used within YouTubeProvider")
  }

  return context
}