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

  // =====================================================
  // 👤 USER LOGIN (NUEVO)
  // =====================================================
  const [user, setUser] = useState(null)

  useEffect(() => {
    const savedUser = localStorage.getItem("mk_user")

    if (savedUser) {
      setUser(JSON.parse(savedUser))
      return
    }

    Swal.fire({
      title: "Bienvenido a MKARAOKE",
      text: "Ingresa tu nombre para continuar",
      input: "text",
      inputPlaceholder: "Tu nombre...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      confirmButtonText: "Entrar",
      background: "#000",
      color: "#06b6d4",
      inputValidator: (value) => {
        if (!value) return "Debes ingresar un nombre"
      }
    }).then((result) => {
      if (result.isConfirmed) {

        const newUser = {
          name: result.value,
          deviceId,
          createdAt: Date.now()
        }

        localStorage.setItem("mk_user", JSON.stringify(newUser))
        setUser(newUser)
      }
    })
  }, [])

  // 🔒 bloquear app hasta login
  if (!user) return null

  // =====================================================
  // RULES
  // =====================================================
  const RULES = {
    MIN_SEARCH_LENGTH: 3,
    MAX_QUEUE_PER_USER: 1,
    MAX_GLOBAL_QUEUE: 50,
    SEARCH_COOLDOWN_MS: 1500,
  }

  const isDuplicateSong = (queue, youtubeId, deviceId) =>
    queue.some(s =>
      s.youtubeId === youtubeId &&
      s.ownerId === deviceId &&
      s.status !== "done" &&
      s.status !== "cancelled"
    )

  const canAddSong = (queue, deviceId) => {
    const mySongs = queue.filter(
      s => s.ownerId === deviceId &&
      s.status !== "done" &&
      s.status !== "cancelled"
    )
    return mySongs.length < RULES.MAX_QUEUE_PER_USER
  }

  const isQueueFull = (queue) =>
    queue.length >= RULES.MAX_GLOBAL_QUEUE

  const showAlert = (config) => {
    if (Swal.isVisible()) Swal.close()
    return Swal.fire(config)
  }

  const alertOpen = useRef(null)
  const alertLocked = useRef(false)
  const lastSearch = useRef(0)

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  // =====================================================
  // FILTRO KARAOKE
  // =====================================================
  const isKaraokeQuery = (text) => {
    const keywords = [
      "karaoke",
      "instrumental",
      "lyrics",
      "letra",
      "cover",
      "backing track"
    ]

    return keywords.some(k =>
      text.toLowerCase().includes(k)
    )
  }

  const forceKaraokeQuery = (text) => {
    if (isKaraokeQuery(text)) return text
    return `${text} karaoke instrumental lyrics`
  }

  // =====================================================
  // SEARCH
  // =====================================================
  const debouncedSearch = useMemo(() =>
    debounce(async (value) => {

      if (!value || value.trim().length < RULES.MIN_SEARCH_LENGTH) {
        setResults([])
        return
      }

      const now = Date.now()
      if (now - lastSearch.current < RULES.SEARCH_COOLDOWN_MS) return
      lastSearch.current = now

      setLoading(true)

      try {
        const data = await searchYouTube(forceKaraokeQuery(value))
        setResults(data || [])
      } catch (err) {
        setResults([])
      }

      setLoading(false)

    }, 600)
  , [])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // =====================================================
  // MY SONG STATE
  // =====================================================
  const mySongs = useMemo(() =>
    queue.filter(song =>
      song.ownerId === deviceId &&
      song.status !== "done" &&
      song.status !== "cancelled"
    )
  , [queue, deviceId])

  const myActiveSong = useMemo(() => mySongs[0] || null, [mySongs])

  const turnsLeft = useMemo(() => {

    if (!myActiveSong) return -1

    const activeQueue = queue.filter(
      s => s.status === "queued" || s.status === "playing"
    )

    return activeQueue.findIndex(s =>
      s.id === myActiveSong.id
    )

  }, [queue, myActiveSong])

  const isMyTurn = turnsLeft === 0
  const isMySongPlaying = currentSong?.id === myActiveSong?.id

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="min-h-screen bg-black text-white relative pb-24 overflow-y-auto">

      {/* HEADER */}
      <div className="relative text-center pt-8">
        <p className="text-zinc-400 text-sm">
          Hola, {user.name}
        </p>

        <h1 className="text-4xl font-black">
          M<span className="text-cyan-400">KARAOKE</span>
        </h1>
      </div>

      {/* SEARCH */}
      <div className="relative px-4 mt-5">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={editMode ? "Buscar reemplazo..." : "Buscar canción..."}
          className="w-full px-4 py-4 text-base rounded-xl bg-black/60 border border-cyan-500/20 outline-none"
        />
      </div>

      {/* RESULTS */}
      <div className="relative px-4 mt-5 space-y-3">

        {loading && <p className="text-zinc-400">Buscando...</p>}

        {results.map(song => (
          <div key={song.youtubeId} className="flex items-center gap-3 p-3 bg-black/60 rounded-xl">

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-14 h-14 rounded-lg"
            />

            <div className="flex-1">
              <p className="font-bold text-sm">{song.title}</p>
              <p className="text-xs text-zinc-400">{song.artist}</p>
            </div>

            <button
              className="px-4 py-2 bg-cyan-500 text-black rounded-lg text-lg active:scale-95"
            >
              +
            </button>

          </div>
        ))}

      </div>

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 w-full bg-black/90 text-center py-3 text-zinc-500 border-t border-zinc-800">
        Cola global: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage