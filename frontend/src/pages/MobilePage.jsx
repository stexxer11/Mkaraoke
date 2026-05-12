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

  // =========================
  // STATES
  // =========================

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const alertOpen = useRef(null)

  // =========================
  // SEARCH
  // =========================

  const debouncedSearch = useMemo(() =>
    debounce(async (value) => {

      if (!value || value.trim().length < 3) {
        setResults([])
        return
      }

      setLoading(true)

      try {
        const data = await searchYouTube(value)
        setResults(data || [])
      } catch (err) {
        console.log(err)
        setResults([])
      }

      setLoading(false)

    }, 700)
  , [])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // =========================
  // RENDER
  // =========================

  return (

    <div className="min-h-screen bg-black overflow-hidden relative text-white">

      {/* =========================
          BACKGROUND GLOW (IGUAL TV)
      ========================= */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[700px] h-[700px] bg-cyan-500/10 blur-3xl rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* =========================
          HEADER (TV STYLE)
      ========================= */}
      <div className="relative z-10 text-center pt-10">

        <h1 className="text-6xl font-black tracking-tight drop-shadow-2xl">
          M<span className="text-cyan-400">KARAOKE</span>
        </h1>

        <p className="text-zinc-400 text-lg mt-2">
          Busca y agrega tu canción
        </p>

      </div>

      {/* =========================
          SEARCH (GLASS TV STYLE)
      ========================= */}
      <div className="relative z-10 px-4 mt-6">

        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={editMode ? "Buscar reemplazo..." : "Buscar canción..."}
          className="
            w-full
            px-4
            py-4
            rounded-2xl
            bg-black/60
            border border-cyan-500/20
            backdrop-blur-xl
            text-white
            outline-none
            focus:border-cyan-400/60
            focus:shadow-[0_0_25px_rgba(34,211,238,0.25)]
          "
        />

      </div>

      {/* =========================
          RESULTS
      ========================= */}
      <div className="relative z-10 px-4 mt-6 space-y-3">

        {loading && (
          <p className="text-zinc-400">Buscando...</p>
        )}

        {results.map(song => (
          <div
            key={song.youtubeId}
            className="
              flex items-center gap-3
              p-3 rounded-2xl
              bg-black/60
              border border-cyan-500/15
              backdrop-blur-xl
            "
          >

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-16 h-16 rounded-xl object-cover"
            />

            <div className="flex-1">
              <p className="font-bold">{song.title}</p>
              <p className="text-sm text-zinc-400">{song.artist}</p>
            </div>

            <button
              className="
                w-10 h-10
                rounded-xl
                bg-cyan-500/15
                text-cyan-300
                font-bold
              "
            >
              +
            </button>

          </div>
        ))}

      </div>

      {/* =========================
          FOOTER
      ========================= */}
      <div className="absolute bottom-3 w-full text-center text-zinc-500 text-sm">
        Cola global: {queue.length}
      </div>

    </div>

  )
}

export default MobilePage