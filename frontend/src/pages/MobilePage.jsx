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
    session,
    user,
    loading: contextLoading,

    loginWithGoogle,
    logout,
    registerUser
  } = useKaraoke()

  // =========================
  // LOCAL STATES
  // =========================
  const [booting, setBooting] = useState(true)

  const [authLoading, setAuthLoading] = useState(false)

  const [profileLoading, setProfileLoading] = useState(false)

  const [appReady, setAppReady] = useState(false)

  const [search, setSearch] = useState("")

  const [results, setResults] = useState([])

  const [searchLoading, setSearchLoading] = useState(false)

  const alertShown = useRef(false)

  const lastSearch = useRef(0)

  // =========================
  // RULES
  // =========================
  const RULES = {
    MIN_SEARCH_LENGTH: 3,
    SEARCH_COOLDOWN_MS: 1500,
  }

  // =========================
  // BOOT SCREEN
  // =========================
  useEffect(() => {

    const timer = setTimeout(() => {
      setBooting(false)
    }, 1200)

    return () => clearTimeout(timer)

  }, [])

  // =========================
  // PROFILE FLOW
  // =========================
 useEffect(() => {

  if (!session?.user?.id) return

  console.log("SESSION:", session)
  console.log("USER:", user)

  // usuario listo
  if (user?.artist_name) {

    console.log("APP READY")

    setAppReady(true)

    return
  }

  // evitar doble popup
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

        Swal.showValidationMessage(
          "Nombre inválido"
        )

        return false
      }

      try {

        setProfileLoading(true)

        const profile = await registerUser(name)

        console.log("REGISTERED:", profile)

        // FORZAR APP READY
        setAppReady(true)

        return true

      } catch (e) {

        console.error("REGISTER ERROR:", e)

        Swal.showValidationMessage(
          e.message || "Error creando perfil"
        )

        return false

      } finally {

        setProfileLoading(false)

      }
    }
  })

}, [session, user])
  // =========================
  // SEARCH ENGINE
  // =========================
  const debouncedSearch = useMemo(() =>

    debounce(async (value) => {

      if (
        !value ||
        value.trim().length < RULES.MIN_SEARCH_LENGTH
      ) {

        setResults([])

        return
      }

      if (
        Date.now() - lastSearch.current <
        RULES.SEARCH_COOLDOWN_MS
      ) {
        return
      }

      lastSearch.current = Date.now()

      try {

        setSearchLoading(true)

        const data = await searchYouTube(
          value + " karaoke instrumental"
        )

        setResults(data || [])

      } catch (e) {

        console.error(e)

        setResults([])

      } finally {

        setSearchLoading(false)

      }

    }, 500)

  , [])

  // =========================
  // HANDLE SEARCH
  // =========================
  function handleSearch(value) {

    setSearch(value)

    debouncedSearch(value)
  }

  // =========================
  // HANDLE LOGIN
  // =========================
  async function handleLogin() {

    try {

      setAuthLoading(true)

      await loginWithGoogle()

    } catch (e) {

      console.error(e)

      Swal.fire({
        icon: "error",
        title: "Error login",
        text: e.message
      })

    } finally {

      setAuthLoading(false)

    }
  }

  // =========================
  // HANDLE LOGOUT
  // =========================
  async function handleLogout() {

    try {

      await logout()

      setAppReady(false)

      alertShown.current = false

    } catch (e) {

      console.error(e)

    }
  }

  // =========================
  // GLOBAL LOADING
  // =========================
  if (
    booting ||
    contextLoading ||
    authLoading ||
    profileLoading
  ) {

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

        <h1 className="text-4xl font-black">
          MKARAOKE 🎤
        </h1>

        <p className="text-zinc-400">
          Conéctate para entrar a la arena
        </p>

        <button
          onClick={handleLogin}
          className="px-6 py-3 bg-cyan-500 text-black rounded-xl font-bold"
        >
          Login con Google
        </button>

      </div>
    )
  }

  // =========================
  // PROFILE LOADING
  // =========================
  if (!appReady) {

    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400">

        <p className="animate-pulse">
          Cargando perfil...
        </p>

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

        Bienvenido {user?.artist_name || "Artista"}

      </div>

      {/* TITLE */}
      <div className="text-center pt-4">

        <h1 className="text-4xl font-black">

          M<span className="text-cyan-400">
            KARAOKE
          </span>

        </h1>

      </div>

      {/* SEARCH */}
      <div className="px-4 mt-5">

        <input
          value={search}
          onChange={(e) =>
            handleSearch(e.target.value)
          }
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

        {results.map((song) => (

          <div
            key={song.youtubeId}
            className="flex gap-3 p-3 bg-black/60 rounded-xl"
          >

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-14 h-14 rounded-lg"
            />

            <div className="flex-1">

              <p className="font-bold text-sm">
                {song.title}
              </p>

              <p className="text-xs text-zinc-400">
                {song.artist}
              </p>

            </div>

            <button
              className="px-4 py-2 bg-cyan-500 text-black rounded-lg"
            >
              +
            </button>

          </div>

        ))}

      </div>

    </div>
  )
}

export default MobilePage