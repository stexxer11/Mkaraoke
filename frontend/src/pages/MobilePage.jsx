import {
  useState,
  useEffect,
  useRef,
} from "react"

import debounce from "lodash.debounce"
import Swal from "sweetalert2"

import { useKaraoke } from "../context/KaraokeContext"
import { searchYouTube } from "../services/youtubeApi"

function MobilePage() {

  const {
    appState,
    isBooting,
    isAuth,
    isReady,

    user,
    queue,
    currentSong,

    registerUser,
    addSong,
  } = useKaraoke()

  // =========================
  // SAFE GUARDS (🔥 CRASH PROOF)
  // =========================
  const safeQueue = Array.isArray(queue) ? queue : []
  const safeUser = user && typeof user === "object" ? user : null

  // =========================
  // LOCAL STATE
  // =========================
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const authShown = useRef(false)

  // =========================
  // AUTH MODAL (SAFE SIDE EFFECT)
  // =========================
  useEffect(() => {

    if (appState !== "AUTH") return
    if (authShown.current) return

    authShown.current = true

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
        return true
      }
    })

  }, [appState, registerUser])

  // =========================
  // DEBOUNCE SAFE (NO useMemo → NO #310 CRASH)
  // =========================
  const debounceRef = useRef(null)

  if (!debounceRef.current) {
    debounceRef.current = debounce(async (value) => {

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
  }

  const handleSearch = (value) => {
    setSearch(value)
    debounceRef.current(value)
  }

  // =========================
  // BOOT STATES
  // =========================
  if (isBooting) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Inicializando sistema...
      </div>
    )
  }

  if (isAuth) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Creando usuario...
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Preparando app...
      </div>
    )
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
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-black text-white pb-24">

      <div className="text-center pt-4 text-sm text-zinc-400">
        Bienvenido, {safeUser?.artist_name || "Artista"}
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

        {loading && <p className="text-zinc-400">Buscando...</p>}

        {results.map(song => (
          <div key={song.youtubeId} className="flex gap-3 p-3 bg-black/60 rounded-xl">

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