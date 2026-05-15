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

  // =========================
  // STATE
  // =========================
  const [booting, setBooting] = useState(true)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  const lastSearch = useRef(0)
  const alertShown = useRef(false)

  // =========================
  // RULES (KARAOKE ENGINE)
  // =========================
  const RULES = {
    MIN_SEARCH_LENGTH: 3,
    SEARCH_COOLDOWN_MS: 1200
  }

  // =========================
  // BOOT SCREEN
  // =========================
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 800)
    return () => clearTimeout(t)
  }, [])

  // =========================
  // REQUIRE ARTIST NAME (SOFT ONBOARDING)
  // =========================
  const requireArtistName = async () => {

    if (user?.artist_name) return true

    if (alertShown.current) return false
    alertShown.current = true

    const { value } = await Swal.fire({
      title: "🎤 Nombre artístico",
      text: "Antes de usar el karaoke necesitas un nombre",
      input: "text",
      inputPlaceholder: "Ej: DJ ROLANDO",
      background: "#000",
      color: "#06b6d4",
      confirmButtonText: "Guardar",
      allowOutsideClick: false,
      allowEscapeKey: false
    })

    const name = value?.trim()

    if (!name) {
      alertShown.current = false
      return false
    }

    try {

      await setArtistName(name)

      await Swal.fire({
        title: "🔥 Bienvenido al escenario",
        text: `Listo ${name}`,
        background: "#000",
        color: "#06b6d4",
        timer: 1500,
        showConfirmButton: false
      })

      alertShown.current = false
      return true

    } catch (e) {

      alertShown.current = false
      return false
    }
  }

  // =========================
  // KARAOKE FORCE QUERY
  // =========================
  const forceKaraokeQuery = (text) => {

    const keywords = [
      "karaoke",
      "instrumental",
      "lyrics",
      "letra",
      "cover",
      "backing track"
    ]

    const ok = keywords.some(k =>
      text.toLowerCase().includes(k)
    )

    return ok
      ? text
      : `${text} karaoke instrumental lyrics`
  }

  // =========================
  // SEARCH ENGINE (YOUTUBE API)
  // =========================
  const debouncedSearch = useMemo(() =>
    debounce(async (value) => {

      if (!value || value.length < RULES.MIN_SEARCH_LENGTH) {
        setResults([])
        return
      }

      const now = Date.now()

      if (now - lastSearch.current < RULES.SEARCH_COOLDOWN_MS) return

      lastSearch.current = now

      try {

        setSearchLoading(true)

        const data = await searchYouTube(
          forceKaraokeQuery(value)
        )

        setResults(data || [])

      } catch (e) {
        setResults([])
      } finally {
        setSearchLoading(false)
      }

    }, 500)
  , [])

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // =========================
  // SEARCH HANDLER
  // =========================
  const handleSearch = async (value) => {

    const ok = await requireArtistName()

    if (!ok) return

    setSearch(value)
    debouncedSearch(value)
  }

  // =========================
  // ADD SONG (SAFE ACTION)
  // =========================
  const handleAddSong = async (song) => {

    const ok = await requireArtistName()

    if (!ok) return

    await Swal.fire({
      title: "🎶 Agregando canción",
      text: song.title,
      background: "#000",
      color: "#06b6d4",
      timer: 800,
      showConfirmButton: false
    })

    console.log("ADD SONG:", song)

    setSearch("")
    setResults([])
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
  // LOADING
  // =========================
  if (booting || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400">
        <p className="animate-pulse">Cargando sistema karaoke...</p>
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

      {/* USER HEADER */}
      <div className="text-center pt-6 text-cyan-400 text-sm">
        Bienvenido {user?.artist_name || user?.email}
      </div>

      {/* TITLE */}
      <div className="text-center pt-4">
        <h1 className="text-4xl font-black">
          M<span className="text-cyan-400">KARAOKE</span>
        </h1>
      </div>

      {/* SEARCH INPUT */}
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
            Buscando canciones...
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
        MKARAOKE • modo live
      </div>

    </div>
  )
}

export default MobilePage