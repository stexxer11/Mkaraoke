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

  const context = useKaraoke()

  // 🧠 PROTECCIÓN (evita crash React #310)
  if (!context) {
    return (
      <div className="text-white p-4">
        Error: KaraokeContext no está disponible
      </div>
    )
  }

  const {
    queue,
    addSong,
    editSong,
    cancelSong,
    deviceId,
    currentSong,
  } = context

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

      showDenyButton: true,
      denyButtonText: "Editar canción",

      showCancelButton: true,
      cancelButtonText: "Cancelar turno",
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
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">

      <div className="text-center pt-8">
        <h1 className="text-4xl font-black">
          MKARAOKE
        </h1>
      </div>

      <div className="px-4 mt-5">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full p-4 bg-black/60 border border-cyan-500/20"
        />
      </div>

      <div className="px-4 mt-5 space-y-3">

        {loading && <p>Buscando...</p>}

        {results.map(song => (
          <div key={song.youtubeId} className="flex gap-3 p-3">

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-14 h-14"
            />

            <div className="flex-1">
              <p>{song.title}</p>
            </div>

            <button
              onClick={() =>
                editMode
                  ? handleReplaceSong(song)
                  : handleAddSong(song)
              }
            >
              +
            </button>

          </div>
        ))}

      </div>

      <div className="fixed bottom-0 w-full text-center">
        Cola global: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage