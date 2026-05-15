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
  } = useKaraoke()

  // =========================
  // LOADING STATES (CLASH ROYALE STYLE FLOW)
  // =========================
  const [booting, setBooting] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const alertOpen = useRef(null)
  const lastSearch = useRef(0)
  const alertShown = useRef(false)

  const RULES = {
    MIN_SEARCH_LENGTH: 3,
    MAX_QUEUE_PER_USER: 1,
    MAX_GLOBAL_QUEUE: 50,
    SEARCH_COOLDOWN_MS: 1500,
  }

  // =========================
  // BOOT SEQUENCE (CLASH ROYALE LOADING SCREEN)
  // =========================
  useEffect(() => {
    const t = setTimeout(() => {
      setBooting(false)
    }, 1800) // fake loading like game intro

    return () => clearTimeout(t)
  }, [])

  // =========================
  // PROFILE CHECK (NEW USER FLOW)
  // =========================
  useEffect(() => {
    if (!session?.user?.id) return
    if (!user) return

    const hasName = user.artist_name || user.artistName

    if (hasName) {
      setProfileLoading(false)
      return
    }

    if (alertShown.current) return
    alertShown.current = true

    Swal.fire({
      title: "🎤 Bienvenido a MKARAOKE",
      text: "Eres un nuevo artista, crea tu nombre",
      input: "text",
      inputPlaceholder: "Ej: DJ Rolando",
      background: "#000",
      color: "#06b6d4",
      allowOutsideClick: false,
      allowEscapeKey: false,
      confirmButtonText: "Entrar a la arena",

      preConfirm: async (value) => {
        const artistName = value?.trim()

        if (!artistName) {
          Swal.showValidationMessage("Nombre inválido")
          return false
        }

        setProfileLoading(true)

        try {
          await registerUser(artistName)
          setProfileLoading(false)
          return true
        } catch (e) {
          setProfileLoading(false)
          Swal.showValidationMessage("Error creando usuario")
          return false
        }
      }
    })
  }, [session, user])

  // =========================
  // KARAOKE SEARCH HELPERS
  // =========================
  const isKaraokeQuery = (text) => {
    const keywords = [
      "karaoke",
      "instrumental",
      "lyrics",
      "letra",
      "cover",
      "backing track"
    ]
    return keywords.some(k => text.toLowerCase().includes(k))
  }

  const forceKaraokeQuery = (text) =>
    isKaraokeQuery(text)
      ? text
      : `${text} karaoke instrumental lyrics`

  const debouncedSearch = useMemo(() =>
    debounce(async (value) => {

      if (!value || value.trim().length < RULES.MIN_SEARCH_LENGTH) {
        setResults([])
        return
      }

      if (Date.now() - lastSearch.current < RULES.SEARCH_COOLDOWN_MS) return

      lastSearch.current = Date.now()
      setLoading(true)

      try {
        const data = await searchYouTube(forceKaraokeQuery(value))
        setResults(data || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }

    }, 600)
  , [])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  // =========================
  // SONG ACTIONS
  // =========================
  const handleAddSong = async (song) => {
    if (queue.length >= RULES.MAX_GLOBAL_QUEUE) return

    const mySongs = queue.filter(
      s => s.owner_id === user?.id &&
        s.status !== "done" &&
        s.status !== "cancelled"
    )

    if (mySongs.length >= RULES.MAX_QUEUE_PER_USER) {
      return Swal.fire({
        icon: "warning",
        title: "Límite alcanzado",
        text: "Solo puedes tener 1 canción en cola",
        background: "#000",
        color: "#06b6d4"
      })
    }

    await addSong(song)
    setSearch("")
    setResults([])
  }

  // =========================
  // LOADING SCREEN (CLASH ROYALE STYLE)
  // =========================
  if (booting || authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-cyan-400">

        <div className="text-4xl font-black animate-pulse">
          MKARAOKE
        </div>

        <p className="mt-4 text-zinc-400 animate-bounce">
          Entrando a la arena...
        </p>

        <div className="mt-6 w-32 h-1 bg-cyan-500/30 overflow-hidden rounded">
          <div className="h-full w-1/2 bg-cyan-400 animate-pulse"></div>
        </div>

      </div>
    )
  }

  // =========================
  // LOGIN SCREEN
  // =========================
  if (!session) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">

        <h1 className="text-4xl font-black">MKARAOKE 🎤</h1>

        <p className="text-zinc-400">
          Conéctate para entrar a la arena
        </p>

        <button
          onClick={async () => {
            setAuthLoading(true)
            await loginWithGoogle()
            setAuthLoading(false)
          }}
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
    <div className="min-h-screen bg-black text-white relative pb-24 overflow-y-auto">

      <div className="text-center pt-4 text-zinc-400 text-sm">
        Bienvenido, {user?.artist_name || "Artista"}
      </div>

      <div className="text-center pt-4">
        <h1 className="text-4xl font-black">
          M<span className="text-cyan-400">KARAOKE</span>
        </h1>
      </div>

      <div className="px-4 mt-5">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar canción..."
          className="w-full px-4 py-4 rounded-xl bg-black/60 border border-cyan-500/20"
        />
      </div>

      <div className="px-4 mt-5 space-y-3">

        {loading && (
          <p className="text-zinc-400 animate-pulse">
            Buscando en la arena...
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
              className="px-4 py-2 bg-cyan-500 text-black rounded-lg"
              onClick={() => handleAddSong(song)}
            >
              +
            </button>

          </div>
        ))}

      </div>

      <div className="fixed bottom-0 w-full bg-black/90 text-center py-3 text-zinc-500 border-t border-zinc-800">
        Cola global: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage