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
    currentSong,

    session,
    user,
    loadingUser,
    registerUser,
  } = useKaraoke()

  // =========================
  // USER
  // =========================
  const userId = user?.id

  console.log("🧠 SESSION:", session)
  console.log("👤 USER:", user)
  console.log("⏳ loadingUser:", loadingUser)
  console.log("🆔 userId:", userId)

  // =========================
  // STATE
  // =========================
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const [forceRegister, setForceRegister] = useState(false)
  const [userReady, setUserReady] = useState(false)

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
  // USER INIT (DEBUG MEJORADO)
  // =========================
  useEffect(() => {

    console.log("🚀 INIT EFFECT TRIGGERED")
    console.log("⏳ loadingUser:", loadingUser)
    console.log("🆔 userId:", userId)
    console.log("👤 user:", user)

    if (loadingUser) {
      console.log("⏳ Esperando loadingUser...")
      return
    }

    if (!userId) {
      console.log("❌ No hay userId todavía")
      return
    }

    const init = async () => {
      try {

        console.log("🔎 INIT USER START")

        if (user?.artist_name) {
          console.log("✅ Usuario ya existe:", user.artist_name)
          setUserReady(true)
          setForceRegister(false)
          return
        }

        console.log("⚠️ Usuario no existe en DB, pidiendo registro")

        if (!alertShown.current) {
          alertShown.current = true

          console.log("🧾 Mostrando Swal de registro")

          setForceRegister(true)
          setUserReady(false)

          Swal.fire({
            title: "Bienvenido nuevo artista 🎤",
            text: "Debes crear tu nombre para continuar",
            input: "text",
            inputPlaceholder: "Ej: DJ Rolando",

            background: "#000",
            color: "#06b6d4",

            allowOutsideClick: false,
            allowEscapeKey: false,

            confirmButtonText: "Crear usuario",

            preConfirm: async (value) => {

              const artistName = value?.trim()

              console.log("✍️ Nombre ingresado:", artistName)

              if (!artistName) {
                Swal.showValidationMessage("Ingresa un nombre válido")
                return false
              }

              try {

                console.log("📡 Registrando usuario...")

                await registerUser(artistName)

                console.log("✅ Usuario registrado OK")

                setUserReady(true)
                setForceRegister(false)

                return true

              } catch (error) {
                console.error("❌ ERROR registerUser:", error)
                Swal.showValidationMessage("Error creando usuario")
                return false
              }
            }
          })
        }

      } catch (error) {
        console.error("❌ INIT USER ERROR:", error)
      }
    }

    init()

  }, [loadingUser, userId, user])

  // =========================
  // LOADING SCREEN (DEBUG)
  // =========================
  if (loadingUser || forceRegister || !userReady) {

    console.log("🟡 BLOQUEADO UI:", {
      loadingUser,
      forceRegister,
      userReady
    })

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Inicializando sistema...
      </div>
    )
  }

  console.log("🟢 APP LISTO - UI DESBLOQUEADA")

  // =========================
  // UI
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar canción..."
          className="w-full px-4 py-4 rounded-xl bg-black/60 border border-cyan-500/20"
        />
      </div>

    </div>
  )
}

export default MobilePage