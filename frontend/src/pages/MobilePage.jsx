import { useState, useMemo } from "react"
import debounce from "lodash.debounce"

import { searchYouTube } from "../services/youtubeApi"

function MobilePage() {

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)

  // =====================
  // SEARCH
  // =====================
  const debouncedSearch = useMemo(
    () =>
      debounce(async (value) => {

        const clean = value?.trim()

        if (!clean || clean.length < 3) {
          setResults([])
          return
        }

        setLoading(true)

        try {
          const data = await searchYouTube(clean + " karaoke")
          setResults(data || [])
        } catch {
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

  // =====================
  // UI
  // =====================
  return (
    <div className="min-h-screen bg-black text-white p-4">

      <h1 className="text-2xl font-bold text-center mb-4">
        MKARAOKE SEARCH
      </h1>

      <input
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar canción..."
        className="w-full p-3 bg-black border border-cyan-500 rounded"
      />

      {/* ===================== */}
      {/* VIDEO PREVIEW */}
      {/* ===================== */}
      {selectedVideo && (
        <div className="mt-4">

          <iframe
            width="100%"
            height="200"
            src={`https://www.youtube.com/embed/${selectedVideo}`}
            title="video"
            allowFullScreen
          />

          <button
            onClick={() => setSelectedVideo(null)}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded"
          >
            Cerrar video
          </button>

        </div>
      )}

      {/* ===================== */}
      {/* RESULTS */}
      {/* ===================== */}
      <div className="mt-4">

        {loading && <p>Buscando...</p>}

        {results.map(song => (
          <div
            key={song.youtubeId}
            className="flex gap-3 p-2 border-b border-zinc-800 items-center"
          >

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-12 h-12 rounded"
            />

            <div className="flex-1">
              <p>{song.title}</p>
              <p className="text-xs text-zinc-400">{song.artist}</p>
            </div>

            {/* BOTÓN VER VIDEO */}
            <button
              onClick={() => setSelectedVideo(song.youtubeId)}
              className="px-3 py-1 bg-cyan-500 text-black rounded"
            >
              Ver
            </button>

          </div>
        ))}

      </div>

    </div>
  )
}

export default MobilePage