import { useState, useMemo } from "react"
import debounce from "lodash.debounce"

import { searchYouTube } from "../services/youtubeApi"

function MobilePage() {

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  // =====================================================
  // SEARCH
  // =====================================================

  const debouncedSearch = useMemo(() =>
    debounce(async (value) => {

      if (!value || value.trim().length < 3) {
        setResults([])
        return
      }

      setLoading(true)

      try {

        console.log("SEARCHING:", value)

        const data = await searchYouTube(
          `${value} karaoke instrumental lyrics`
        )

        console.log("RESULTS:", data)

        setResults(data || [])

      } catch (err) {

        console.log("SEARCH ERROR", err)

        setResults([])
      }

      setLoading(false)

    }, 500)
  , [])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-screen bg-black text-white p-5">

      <h1 className="text-4xl font-black mb-6">
        M<span className="text-cyan-400">KARAOKE</span>
      </h1>

      {/* INPUT */}
      <input
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar canción..."
        className="w-full p-4 rounded-2xl bg-zinc-900 border border-zinc-700 outline-none"
      />

      {/* LOADING */}
      {loading && (
        <p className="mt-5 text-zinc-400">
          Buscando...
        </p>
      )}

      {/* RESULTS */}
      <div className="mt-5 space-y-3">

        {results.map(song => (

          <div
            key={song.youtubeId}
            className="bg-zinc-900 rounded-2xl p-3 flex gap-3 items-center"
          >

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              alt=""
              className="w-20 h-20 rounded-xl object-cover"
            />

            <div>
              <p className="font-bold">
                {song.title}
              </p>

              <p className="text-zinc-400 text-sm">
                {song.artist}
              </p>

              <p className="text-cyan-400 text-xs mt-1">
                {song.youtubeId}
              </p>
            </div>

          </div>

        ))}

      </div>

    </div>
  )
}

export default MobilePage