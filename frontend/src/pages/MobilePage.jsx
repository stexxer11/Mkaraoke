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

    user,
    loadingUser,
    registerUser
  } = useKaraoke()

  // =========================
  // USER FIRST TIME MODAL
  // =========================
  const [nameInput, setNameInput] = useState("")
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    if (!loadingUser && !user) {
      setShowWelcome(true)
    } else {
      setShowWelcome(false)
    }
  }, [user, loadingUser])

  const handleRegister = async () => {
    if (!nameInput.trim()) return

    await registerUser(nameInput.trim())

    Swal.fire({
      icon: "success",
      title: "Bienvenido 🎤",
      text: "Tu usuario fue creado",
      background: "#000",
      color: "#06b6d4",
      timer: 1500,
      showConfirmButton: false
    })
  }

  // =========================
  // RULES
  // =========================
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

  // =========================
  // SEARCH STATE
  // =========================
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const alertOpen = useRef(null)
  const alertLocked = useRef(false)
  const lastSearch = useRef(0)

  // =========================
  // KARAOKE FILTER
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

    return keywords.some(k =>
      text.toLowerCase().includes(k)
    )
  }

  const forceKaraokeQuery = (text) => {
    if (isKaraokeQuery(text)) return text
    return `${text} karaoke instrumental lyrics`
  }

  // =========================
  // SEARCH
  // =========================
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
      } catch {
        setResults([])
      }

      setLoading(false)

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
  // MY SONG STATE
  // =========================
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

  // =========================
  // ALERT SYSTEM (TU ORIGINAL)
  // =========================
  useEffect(() => {

    if (!myActiveSong) {
      alertOpen.current = null
      alertLocked.current = false
      Swal.close()
      return
    }

    if (alertLocked.current && editMode) return

    const activeQueue = queue.filter(
      s => s.status === "queued" || s.status === "playing"
    )

    const position = activeQueue.findIndex(
      s => s.id === myActiveSong.id
    )

    const turnsLeftValue = position === -1 ? 0 : position

    const alertKey =
      `${myActiveSong.id}-${turnsLeftValue}-${currentSong?.id}`

    if (alertOpen.current === alertKey) return

    alertOpen.current = alertKey

    if (isMySongPlaying) {

      alertLocked.current = true

      Swal.fire({
        title: "Disfruta tu canción 🎤",
        html: `<b>${myActiveSong.title}</b>`,
        background: "#000",
        color: "#06b6d4",
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
      })

      return
    }

    showAlert({
      title: isMyTurn
        ? "Tu turno está listo 🎤"
        : `Te faltan ${turnsLeftValue} turno(s)`,

      html: `<b>${myActiveSong.title}</b>`,

      background: "#000",
      color: "#06b6d4",
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
    })

  }, [
    queue,
    currentSong,
    myActiveSong,
    turnsLeft,
    isMyTurn,
    isMySongPlaying,
    deviceId,
    editMode
  ])

  // =========================
  // ACTIONS
  // =========================
  const handleAddSong = async (song) => {

    if (isQueueFull(queue)) return
    if (!canAddSong(queue, deviceId)) return
    if (isDuplicateSong(queue, song.youtubeId, deviceId)) return

    await addSong(song)

    setSearch("")
    setResults([])
  }

  const handleReplaceSong = async (song) => {

    if (!editSongData) return
    if (currentSong?.id === editSongData.id) return

    await editSong(editSongData.id, song)

    setEditMode(false)
    setEditSongData(null)
    setSearch("")
    setResults([])

    alertOpen.current = null
    alertLocked.current = false
  }

  // =========================
  // LOADING USER
  // =========================
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Cargando usuario...
      </div>
    )
  }

  // =========================
  // WELCOME SCREEN (SWAL CONTROL)
  // =========================
  if (showWelcome) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">

        <div className="bg-zinc-900 p-6 rounded-xl w-[90%] max-w-md">

          <h2 className="text-xl font-bold mb-3">
            Bienvenido a MKaraoke
          </h2>

          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full p-3 bg-black border border-cyan-500 rounded-lg"
            placeholder="Nombre de artista"
          />

          <button
            className="mt-4 w-full bg-cyan-500 text-black p-3 rounded-lg"
            onClick={handleRegister}
          >
            Crear usuario
          </button>

        </div>
      </div>
    )
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-black text-white relative pb-24 overflow-y-auto">

      <div className="text-center pt-4 text-zinc-400 text-sm">
        Bienvenido, {user?.artistName}
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
              className="px-4 py-2 bg-cyan-500 text-black rounded-lg"
              onClick={() =>
                editMode ? handleReplaceSong(song) : handleAddSong(song)
              }
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