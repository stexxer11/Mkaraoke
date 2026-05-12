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
    if (Swal.isVisible()) return
    return Swal.fire({
      ...config,
      background: "#0b0b0b",
      color: "#fff",
      confirmButtonColor: "#06b6d4",
      position: "center",
      heightAuto: false
    })
  }

  const alertOpen = useRef(null)
  const lastSearch = useRef(0)

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const isKaraokeQuery = (text) => {
    const keywords = ["karaoke", "instrumental", "lyrics", "letra", "cover", "backing track"]
    return keywords.some(k => text.toLowerCase().includes(k))
  }

  const forceKaraokeQuery = (text) =>
    isKaraokeQuery(text) ? text : `${text} karaoke instrumental lyrics`

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

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])

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
    const activeQueue = queue.filter(s => s.status === "queued" || s.status === "playing")
    return activeQueue.findIndex(s => s.id === myActiveSong.id)
  }, [queue, myActiveSong])

  const isMyTurn = turnsLeft === 0
  const isMySongPlaying = currentSong?.id === myActiveSong?.id

  useEffect(() => {

    if (!myActiveSong) {
      alertOpen.current = null
      if (Swal.isVisible()) Swal.close()
      return
    }

    const alertKey = `${myActiveSong.id}-${turnsLeft}-${currentSong?.id}`

    if (alertOpen.current === alertKey) return
    alertOpen.current = alertKey

    if (isMySongPlaying) {
      showAlert({
        title: "Tu canción está sonando",
        html: myActiveSong.title,
        showConfirmButton: false,
      })
      return
    }

    showAlert({
      title: isMyTurn ? "Tu turno" : "En cola",
      html: myActiveSong.title,
      showDenyButton: true,
      denyButtonText: "Editar",
      showCancelButton: true,
      cancelButtonText: "Cancelar"
    }).then(res => {

      if (res.isDenied) {
        setEditMode(true)
        setEditSongData(myActiveSong)
        setSearch("")
        setResults([])
      }

      if (res.dismiss === Swal.DismissReason.cancel) {
        showAlert({
          title: "Cancelar canción?",
          showCancelButton: true
        }).then(async c => {
          if (c.isConfirmed) await cancelSong(myActiveSong.id)
        })
      }

    })

  }, [queue, currentSong, myActiveSong, turnsLeft])

  const handleAddSong = async (song) => {

    if (isQueueFull(queue)) return

    if (!canAddSong(queue, deviceId)) {
      showAlert({ title: "Solo 1 canción por usuario" })
      return
    }

    if (isDuplicateSong(queue, song.youtubeId, deviceId)) {
      showAlert({ title: "Ya agregada" })
      return
    }

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

    <div className="min-h-screen bg-black text-white pb-[80px]">

      <div className="text-center pt-6">
        <h1 className="text-4xl font-black">
          M<span className="text-cyan-400">KARAOKE</span>
        </h1>
      </div>

      <div className="px-4 mt-4">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={editMode ? "Reemplazar canción" : "Buscar canción"}
          className="w-full px-4 py-4 text-lg rounded-xl bg-zinc-900 border border-cyan-500/20"
        />
      </div>

      <div className="px-4 mt-4 space-y-3">

        {loading && <p className="text-zinc-400">Buscando...</p>}

        {results.map(song => (

          <div key={song.youtubeId} className="flex items-center gap-3 bg-zinc-900 p-3 rounded-xl">

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

      <div className="fixed bottom-0 left-0 w-full bg-black/90 text-center py-3 text-zinc-400 border-t border-zinc-800">
        Cola: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage