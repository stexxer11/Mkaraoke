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
  const userId = session?.user?.id

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

  // =========================
  // RULES
  // =========================
  const RULES = {
    MIN_SEARCH_LENGTH: 3,
    MAX_QUEUE_PER_USER: 1,
    MAX_GLOBAL_QUEUE: 50,
    SEARCH_COOLDOWN_MS: 1500,
  }

  // =========================
  // USER INIT (FIXED)
  // =========================
  useEffect(() => {

    if (loadingUser) return
    if (!userId) return

    const init = async () => {

      try {

        // 🔥 IMPORTANTE: usar user del contexto, NO getUser()
        if (user?.artist_name) {
          setUserReady(true)
          setForceRegister(false)
          return
        }

        if (!alertShown.current) {

          alertShown.current = true
          setForceRegister(true)
          setUserReady(false)

          Swal.fire({
            title: "Bienvenido 🎤",
            text: "Debes crear tu nombre",
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

              try {

                await registerUser(name)

                setUserReady(true)
                setForceRegister(false)

                return true

              } catch (err) {
                Swal.showValidationMessage("Error creando usuario")
                return false
              }
            }
          })
        }

      } catch (error) {
        console.error(error)
      }
    }

    init()

  }, [loadingUser, userId, user])

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
        const data = await searchYouTube(value)
        setResults(data || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }

    }, 600)
  , [])

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  // =========================
  // ADD SONG
  // =========================
  const handleAddSong = async (song) => {

    if (!userId) return

    await addSong({
      ownerId: userId,
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId,
    })

    setSearch("")
    setResults([])
  }

  // =========================
  // LOADING FIX
  // =========================
  if (loadingUser || forceRegister || !userReady) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Inicializando sistema...
      </div>
    )
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-black text-white">

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