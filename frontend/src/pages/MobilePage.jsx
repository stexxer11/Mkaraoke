import {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react"

import debounce from "lodash.debounce"
import Swal from "sweetalert2"

import { useKaraoke } from "../context/KaraokeContext"
import { searchYouTube } from "../services/youtubeApi"

function MobilePage() {

  const {
    queue,
    addSong,
    editSong,
    cancelSong,
    deviceId,
    currentSong,
  } = useKaraoke()

  const RULES = {
    MIN_SEARCH_LENGTH: 3, // 👈 CAMBIO IMPORTANTE
    MAX_QUEUE_PER_USER: 1,
    MAX_GLOBAL_QUEUE: 50,
    SEARCH_COOLDOWN_MS: 1500,
  }

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const lastSearch = useRef(0)

  // =====================================================
  // SEARCH (SOLO 3 LETRAS)
  // =====================================================
  const debouncedSearch = useMemo(
    () =>
      debounce(async (value) => {

        const clean = value?.trim()

        // 🚨 SOLO BUSCA SI HAY 3 LETRAS
        if (!clean || clean.length < RULES.MIN_SEARCH_LENGTH) {
          setResults([])
          return
        }

        const now = Date.now()

        if (now - lastSearch.current < RULES.SEARCH_COOLDOWN_MS) return
        lastSearch.current = now

        setLoading(true)

        try {
          const data = await searchYouTube(clean)
          setResults(data || [])
        } catch (err) {
          console.log("search error:", err)
          setResults([])
        }

        setLoading(false)

      }, 500),
    []
  )

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // =====================================================
  // UI SIMPLE
  // =====================================================
  return (
    <div className="min-h-screen bg-black text-white p-4">

      <h1 className="text-xl font-bold mb-4 text-center">
        MKARAOKE SEARCH
      </h1>

      <input
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Escribe mínimo 3 letras..."
        className="w-full p-3 bg-black border border-cyan-500 rounded"
      />

      <div className="mt-4 space-y-3">

        {loading && (
          <p className="text-zinc-400">Buscando...</p>
        )}

        {results.map((song) => (
          <div
            key={song.youtubeId}
            className="flex gap-3 items-center border-b border-zinc-800 pb-2"
          >

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-12 h-12 rounded"
            />

            <div>
              <p className="text-sm font-bold">
                {song.title}
              </p>
              <p className="text-xs text-zinc-400">
                {song.artist}
              </p>
            </div>

          </div>
        ))}

      </div>

    </div>
  )
}

export default MobilePage