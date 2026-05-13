import { createContext, useContext, useState, useRef } from "react"
import { searchYouTube } from "../services/youtubeApi"

const YouTubeContext = createContext()

export function YouTubeProvider({ children }) {

  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  // evita respuestas fuera de orden (muy común en search rápido)
  const lastQueryRef = useRef("")

  const searchSongs = async (query) => {

    const cleanQuery = query?.trim()

    if (!cleanQuery || cleanQuery.length < 2) {
      setResults([])
      return
    }

    lastQueryRef.current = cleanQuery
    setLoading(true)

    try {
      const data = await searchYouTube(cleanQuery)

      // evita que una respuesta vieja pise una nueva
      if (lastQueryRef.current !== cleanQuery) return

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