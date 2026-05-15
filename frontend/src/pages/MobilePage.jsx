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
    queue,
    addSong,
    editSong,
    currentSong,

    user,
    loadingUser,
    registerUser,
    getUser,

    session,
    loginWithGoogle,
    logout
  } = useKaraoke()

  // =========================
  // STATE
  // =========================
  const [booting, setBooting] = useState(true)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

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
  // BOOT
  // =========================
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 800)
    return () => clearTimeout(t)
  }, [])

  // =========================
  // USER INIT (FIX REAL FLOW)
  // =========================
  useEffect(() => {

    if (loadingUser) return
    if (!session?.user?.id) return

    const initUser = async () => {

      try {

        const u = await getUser(session.user.id)

        if (u?.artistName) {
          setUserReady(true)
          return
        }

        // 👇 NO USER → CREATE FLOW
        if (!alertShown.current) {

          alertShown.current = true

          Swal.fire({
            title: "🎤 Bienvenido artista",
            text: "Crea tu nombre artístico",
            input: "text",
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

              const updated = await getUser(session.user.id)

              if (updated?.artistName) {
                setUserReady(true)
                alertShown.current = false
                return true
              }

              return false
            }
          })
        }

      } catch (e) {
        console.error("USER INIT ERROR:", e)
      }
    }

    initUser()

  }, [session, loadingUser])

  // =========================
  // KARAOKE FILTER
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

    const has = keywords.some(k =>
      text.toLowerCase().includes(k)
    )

    return has ? text : `${text} karaoke instrumental lyrics`
  }

  // =========================
  // SEARCH ENGINE
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

        setLoading(true)

        const data = await searchYouTube(
          forceKaraokeQuery(value)
        )

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
  }, [debouncedSearch])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  // =========================
  // ADD SONG
  // =========================
  const handleAddSong = async (song) => {

    if (!user?.artistName) return

    if (queue.length >= RULES.MAX_GLOBAL_QUEUE) return

    const mySongs = queue.filter(
      s =>
        s.ownerId === session?.user?.id &&
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
  // REPLACE SONG
  // =========================
  const handleReplaceSong = async (song) => {

    if (!editSongData) return
    await editSong(editSongData.id, song)

    setEditMode(false)
    setEditSongData(null)

    setSearch("")
    setResults([])
  }

  // =========================
  // ALERT SYSTEM
  // =========================
  useEffect(() => {

    if (!queue.length) return

    const mySong = queue.find(
      s => s.ownerId === session?.user?.id
    )

    if (!mySong) return

    const key = `${mySong.id}-${currentSong?.id}`

    if (alertOpen.current === key) return

    alertOpen.current = key

    if (currentSong?.id === mySong.id) {

      Swal.fire({
        title: "🎤 Estás cantando",
        html: `<b>${mySong.title}</b>`,
        background: "#000",
        color: "#06b6d4",
        showConfirmButton: false
      })

    } else {

      Swal.fire({
        title: "⏳ Tu turno viene",
        html: `<b>${mySong.title}</b>`,
        background: "#000",
        color: "#06b6d4",
        showConfirmButton: false
      })
    }

  }, [queue, currentSong])

  // =========================
  // LOADING BLOCK
  // =========================
  if (loadingUser || !userReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400">
        <p className="animate-pulse">Inicializando sistema...</p>
      </div>
    )
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-black text-white relative pb-24 overflow-y-auto">

      {/* HEADER */}
      <div className="text-center pt-4 text-zinc-400 text-sm">
        Bienvenido, {user?.artistName || "Artista"}
      </div>

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
              onClick={() =>
                editMode
                  ? handleReplaceSong(song)
                  : handleAddSong(song)
              }
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