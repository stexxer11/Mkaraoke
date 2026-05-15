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
    currentSong,
    session,
    user,
    registerUser,
    loginWithGoogle,
    logout, // 👈 IMPORTANTE
  } = useKaraoke()

  // =========================
  // APP STATES (FLOW CONTROL)
  // =========================
  const [booting, setBooting] = useState(true)
  const [checkingUser, setCheckingUser] = useState(true)

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const alertShown = useRef(false)
  const alertOpen = useRef(null)
  const lastSearch = useRef(0)

  const RULES = {
    MIN_SEARCH_LENGTH: 3,
    MAX_QUEUE_PER_USER: 1,
    MAX_GLOBAL_QUEUE: 50,
    SEARCH_COOLDOWN_MS: 1500,
  }

  // =========================
  // BOOT (CLASH ROYALE INTRO)
  // =========================
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 1500)
    return () => clearTimeout(t)
  }, [])

  // =========================
  // USER CHECK + ONBOARDING
  // =========================
  useEffect(() => {
    if (!session?.user?.id) return

    const hasName = user?.artist_name || user?.artistName

    if (hasName) {
      setCheckingUser(false)
      return
    }

    if (alertShown.current) return
    alertShown.current = true

    Swal.fire({
      title: "🎤 Bienvenido a MKARAOKE",
      text: "Crea tu nombre artístico",
      input: "text",
      inputPlaceholder: "Ej: MX23",
      background: "#000",
      color: "#06b6d4",
      allowOutsideClick: false,
      allowEscapeKey: false,
      confirmButtonText: "Entrar",

      preConfirm: async (value) => {
        const name = value?.trim()

        if (!name) {
          Swal.showValidationMessage("Nombre inválido")
          return false
        }

        await registerUser(name)
        setCheckingUser(false)
        return true
      }
    })
  }, [session, user])

  // =========================
  // SEARCH
  // =========================
  const debouncedSearch = useMemo(() =>
    debounce(async (value) => {

      if (!value || value.length < RULES.MIN_SEARCH_LENGTH) {
        setResults([])
        return
      }

      if (Date.now() - lastSearch.current < RULES.SEARCH_COOLDOWN_MS) return

      lastSearch.current = Date.now()
      setLoading(true)

      try {
        const data = await searchYouTube(value + " karaoke")
        setResults(data || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }

    }, 500)
  , [])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  // =========================
  // ADD SONG
  // =========================
  const handleAddSong = async (song) => {
    await addSong(song)
    setSearch("")
    setResults([])
  }

  // =========================
  // LOADING SCREEN
  // =========================
  if (booting || checkingUser) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-cyan-400">
        <h1 className="text-3xl font-black animate-pulse">MKARAOKE</h1>
        <p className="mt-2 text-zinc-400">Entrando a la arena...</p>
      </div>
    )
  }

  // =========================
  // LOGIN SCREEN
  // =========================
  if (!session) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">

        <h1 className="text-4xl font-black">MKARAOKE 🎤</h1>

        <p className="text-zinc-400">
          Inicia sesión para entrar
        </p>

        <button
          onClick={loginWithGoogle}
          className="px-6 py-3 bg-cyan-500 text-black rounded-xl font-bold"
        >
          Login con Google
        </button>

      </div>
    )
  }

  // =========================
  // MAIN APP
  // =========================
  return (
    <div className="min-h-screen bg-black text-white pb-24">

      {/* HEADER */}
      <div className="text-center pt-4 text-zinc-400 text-sm">
        Bienvenido {user?.artist_name || "Artista"}
      </div>

      {/* LOGOUT */}
      <button
        onClick={async () => {
          await logout()
          alertShown.current = false
        }}
        className="absolute top-3 right-3 px-3 py-1 bg-red-500 text-black text-xs rounded-lg"
      >
        Logout
      </button>

      {/* TITLE */}
      <div className="text-center pt-4">
        <h1 className="text-4xl font-black">
          M<span className="text-cyan-400">KARAOKE</span>
        </h1>
      </div>

      {/* SEARCH */}
      <div className="px-4 mt-5">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar canción..."
          className="w-full px-4 py-4 rounded-xl bg-black/60 border border-cyan-500/20"
        />
      </div>

      {/* RESULTS */}
      <div className="px-4 mt-5 space-y-3">

        {loading && (
          <p className="text-zinc-400 animate-pulse">
            Buscando...
          </p>
        )}

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

      {/* FOOTER */}
      <div className="fixed bottom-0 w-full bg-black/90 text-center py-3 text-zinc-500 border-t border-zinc-800">
        Cola global: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage