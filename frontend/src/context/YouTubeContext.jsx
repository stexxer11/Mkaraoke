import { createContext, useContext, useState } from "react"
import { searchYouTube } from "../services/youtubeApi"

const YouTubeContext = createContext()

export function YouTubeProvider({ children }) {

  // =========================
  // STATE
  // =========================
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  // =========================
  // SEARCH SONGS
  // =========================
  const searchSongs = async (query) => {

    if (!query || query.trim().length < 2) {
      setResults([])
      return
    }

    setLoading(true)

    try {

      const data = await searchYouTube(query)

      if (Array.isArray(data)) {
        setResults(data)
      } else {
        setResults([])
      }

    } catch (err) {

      console.error("YouTube Search Error:", err)

      setResults([])

    } finally {

      setLoading(false)

    }

  }

  // =========================
  // PROVIDER
  // =========================
  return (

    <YouTubeContext.Provider
      value={{
        results,
        loading,
        searchSongs,
      }}
    >

      {children}

    </YouTubeContext.Provider>

  )

}

export function useYouTube() {
  return useContext(YouTubeContext)
}