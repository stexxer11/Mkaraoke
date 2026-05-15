import {
  useState,
  useEffect,
  useRef,
  useMemo
} from "react"

import debounce from "lodash.debounce"
import Swal from "sweetalert2"

import { useKaraoke } from "../context/KaraokeContext"
import { searchYouTube } from "../services/youtubeApi"

function MobilePage() {

  const {
    session,
    user,
    loading,
    loginWithGoogle,
    logout,
    setArtistName
  } = useKaraoke()

  const [booting, setBooting] = useState(true)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  const lastSearch = useRef(0)

  const RULES = {
    MIN_SEARCH_LENGTH: 3,
    SEARCH_COOLDOWN_MS: 1200
  }

  // =========================
  // BOOT
  // =========================
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 800)
    return () => clearTimeout(t)
  }, [])

  // =========================
  // REQUIRE ARTIST NAME (ON DEMAND)
  // =========================
  const requireArtistName = async () => {

    if (user?.artist_name) return true

    const { value } = await Swal.fire({
      title: "🎤 Nombre artístico",
      text: "Necesitas un nombre para continuar",
      input: "text",
      confirmButtonText: "Guardar",
      allowOutsideClick: false,
      allowEscapeKey: false
    })

    const name = value?.trim()

    if (!name) return false

    await setArtistName(name)

    return true
  }

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

      try {

        setSearchLoading(true)

        const data = await searchYouTube(
          value + " karaoke instrumental"
        )

        setResults(data || [])

      } catch (e) {
        setResults([])
      } finally {
        setSearchLoading(false)
      }

    }, 400)
  , [])

  const handleSearch = async (value) => {

    const ok = await requireArtistName()

    if (!ok) return

    setSearch(value)
    debouncedSearch(value)
  }

  // =========================
  // ADD SONG
  // =========================
  const handleAddSong = async (song) => {

    const ok = await requireArtistName()

    if (!ok) return

    console.log("ADD SONG:", song)
  }

  // =========================
  // LOGIN
  // =========================
  async function handleLogin() {
    await loginWithGoogle()
  }

  // =========================
  // LOGOUT
  // =========================
  async function handleLogout() {
    await logout()
  }

  // =========================
  // BOOT SCREEN
  // =========================
  if (booting || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400">
        <p className="animate-pulse">Cargando...</p>
      </div>
    )
  }

  // =========================
  // LOGIN SCREEN
  // =========================
  if (!session) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-white">

        <h1 className="text-4xl font-black">
          MKARAOKE 🎤
        </h1>

        <button
          onClick={handleLogin}
          className="px-6 py-3 bg-cyan-500 text-black rounded-xl font-bold"
        >
          Entrar con Google
        </button>

      </div>
    )
  }

  // =========================
  // MAIN APP
  // =========================
  return (
    <div className="min-h-screen bg-black text-white pb-24 relative">

      {/* LOGOUT */}
      <button
        onClick={handleLogout}
        className="absolute top-3 right-3 px-3 py-1 bg-red-500 text-black text-xs rounded-lg"
      >
        Logout
      </button>

      {/* USER */}
      <div className="text-center pt-6 text-cyan-400 text-sm">
        Bienvenido {user?.artist_name || user?.email}
      </div>

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

        {searchLoading && (
          <p className="text-zinc-400 animate-pulse">
            Buscando...
          </p>
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

            <button className="px-4 py-2 bg-cyan-500 text-black rounded-lg">
              +
            </button>

          </div>
        ))}

      </div>

    </div>
  )
}

export default MobilePage