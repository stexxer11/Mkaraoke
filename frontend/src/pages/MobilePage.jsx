import {
  useState,
  useEffect,
  useRef,
} from "react"

import Swal from "sweetalert2"
import debounce from "lodash.debounce"

import { useKaraoke } from "../context/KaraokeContext"
import { searchYouTube } from "../services/youtubeApi"

function MobilePage() {

  const {
    session,
    user,
    isAuth,
    isProfile,
    isReady,

    queue = [],

    registerUser,
    addSong,
  } = useKaraoke()

  // =========================
  // SAFE STATE
  // =========================
  const safeQueue = Array.isArray(queue) ? queue : []

  // =========================
  // LOCAL STATE
  // =========================
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const modalShown = useRef(false)

  // =========================
  // PROFILE MODAL (FIXED)
  // =========================
  useEffect(() => {

    if (!isProfile) return
    if (modalShown.current) return

    modalShown.current = true

    Swal.fire({
      title: "Bienvenido 🎤",
      text: "Crea tu nombre artístico",
      input: "text",
      background: "#000",
      color: "#06b6d4",
      allowOutsideClick: false,
      confirmButtonText: "Crear",

      preConfirm: async (value) => {
        const name = value?.trim()

        if (!name) {
          Swal.showValidationMessage("Nombre inválido")
          return false
        }

        await registerUser(name)
      }
    })

  }, [isProfile, registerUser])

  // =========================
  // DEBOUNCE (STABLE - NO RECREA)
  // =========================
  const debounceRef = useRef(
    debounce(async (value) => {

      if (!value || value.length < 3) {
        setResults([])
        return
      }

      setLoading(true)

      try {
        const res = await searchYouTube(value)
        setResults(res || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }

    }, 500)
  )

  const handleSearch = (value) => {
    setSearch(value)
    debounceRef.current(value)
  }

  // =========================
  // ADD SONG SAFE
  // =========================
  const handleAddSong = async (song) => {
    await addSong(song)
    setSearch("")
    setResults([])
  }

  // =========================
  // LOADING STATES (CLEAN)
  // =========================
  if (isAuth) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Iniciando sesión...
      </div>
    )
  }

  if (isProfile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Preparando perfil...
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Cargando sistema...
      </div>
    )
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-black text-white pb-24">

      <div className="text-center pt-4 text-sm text-zinc-400">
        Bienvenido, {user?.artist_name}
      </div>

      <h1 className="text-center text-4xl font-black mt-3">
        M<span className="text-cyan-400">KARAOKE</span>
      </h1>

      <div className="px-4 mt-6">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full p-4 bg-black border border-cyan-500 rounded-xl"
          placeholder="Buscar canción..."
        />
      </div>

      <div className="px-4 mt-4 space-y-3">

        {loading && (
          <p className="text-zinc-400">Buscando...</p>
        )}

        {results.map(song => (
          <div
            key={song.youtubeId}
            className="flex gap-3 p-3 bg-black/60 rounded-xl"
          >

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-14 h-14 rounded-lg"
            />

            <div className="flex-1">
              <p className="font-bold text-sm">{song.title}</p>
              <p className="text-xs text-zinc-400">{song.artist}</p>
            </div>

            <button
              onClick={() => handleAddSong(song)}
              className="px-4 py-2 bg-cyan-500 text-black rounded-lg"
            >
              +
            </button>

          </div>
        ))}

      </div>

      <div className="fixed bottom-0 w-full bg-black text-center py-3 border-t border-zinc-800">
        Cola: {safeQueue.length}
      </div>

    </div>
  )
}

export default MobilePage