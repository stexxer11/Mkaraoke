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
  // RULE ENGINE (25 REGLAS)
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
    if (Swal.isVisible()) return
    return Swal.fire(config)
  }

  const alertOpen = useRef(null)
  const lastSearch = useRef(0)

  // =====================================================
  // STATES
  // =====================================================

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  // =====================================================
  // SEARCH (REGLAS 1, 2, 24)
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
        const data = await searchYouTube(value)
        setResults(data || [])
      } catch (err) {
        console.log(err)
        setResults([])
      }

      setLoading(false)

    }, 700)
  , [])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // =====================================================
  // RULE 4 - MY SONGS
  // =====================================================

  const mySongs = useMemo(() =>
    queue.filter(song =>
      song.ownerId === deviceId &&
      song.status !== "done" &&
      song.status !== "cancelled"
    )
  , [queue, deviceId])

  // =====================================================
  // RULE 5 - ACTIVE SONG
  // =====================================================

  const myActiveSong = useMemo(() => mySongs[0] || null, [mySongs])

  // =====================================================
  // RULE 6 - TURN POSITION
  // =====================================================

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
  // RULE 7 - AUTO CLOSE EDIT
  // =====================================================

  useEffect(() => {

    if (isMySongPlaying && editMode) {
      setEditMode(false)
      setEditSongData(null)
      setSearch("")
      setResults([])
    }

  }, [isMySongPlaying, editMode])

  // =====================================================
  // RULE 8-12 - ALERT SYSTEM CORE
  // =====================================================

  useEffect(() => {

    if (!myActiveSong) {
      alertOpen.current = null
      if (Swal.isVisible()) Swal.close()
      return
    }

    const alertKey =
      `${myActiveSong.id}-${turnsLeft}-${currentSong?.id}`

    if (alertOpen.current === alertKey) return

    alertOpen.current = alertKey

    // ================= RULE 10 =================
    if (isMySongPlaying) {

      showAlert({
        title: "Disfruta tu canción 🎤",
        html: `<b>${myActiveSong.title}</b>`,
        background: "#000",
        color: "#06b6d4",
        showConfirmButton: false,
      })

      return
    }

    // ================= RULE 11-12 =================
    showAlert({
      title: isMyTurn ? "Tu turno está listo 🎤" : "Tu canción está en cola",
      html: `<b>${myActiveSong.title}</b>`,
      background: "#000",
      color: "#06b6d4",
      showDenyButton: true,
      denyButtonText: "Editar canción",
      showCancelButton: true,
      cancelButtonText: "Cancelar turno",
    }).then(res => {

      if (res.isDenied && !isMySongPlaying) {
        setEditMode(true)
        setEditSongData(myActiveSong)
        setSearch("")
        setResults([])
      }

      if (res.dismiss === Swal.DismissReason.cancel) {

        showAlert({
          title: "¿Cancelar canción?",
          icon: "warning",
          showCancelButton: true,
        }).then(async confirm => {

          if (confirm.isConfirmed) {
            await cancelSong(myActiveSong.id)
          }

        })
      }

    })

  }, [
    queue,
    currentSong,
    myActiveSong,
    turnsLeft,
    isMyTurn,
    isMySongPlaying,
    deviceId
  ])

  // =====================================================
  // RULE 16 - ADD SONG
  // =====================================================

  const handleAddSong = async (song) => {

    if (isQueueFull(queue)) return

    if (!canAddSong(queue, deviceId)) {
      showAlert({
        icon: "warning",
        title: "Ya tienes una canción",
      })
      return
    }

    if (isDuplicateSong(queue, song.youtubeId, deviceId)) {
      showAlert({
        icon: "info",
        title: "Canción duplicada",
      })
      return
    }

    await addSong(song)

    setSearch("")
    setResults([])
  }

  // =====================================================
  // RULE 17 - REPLACE SONG
  // =====================================================

  const handleReplaceSong = async (song) => {

    if (!editSongData) return

    if (currentSong?.id === editSongData.id) return

    await editSong(editSongData.id, song)

    setEditMode(false)
    setEditSongData(null)
    setSearch("")
    setResults([])
  }

  // =====================================================
  // RULE 18-25 UI (YA INCLUIDO EN LOGICA)
  // =====================================================

  return (

    <div className="min-h-screen bg-black text-white relative">

      {/* BACKGROUND */}
      <div className="absolute inset-0">
        <div className="absolute w-[700px] h-[700px] bg-cyan-500/10 blur-3xl rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* HEADER */}
      <div className="relative text-center pt-10">
        <h1 className="text-6xl font-black">
          M<span className="text-cyan-400">KARAOKE</span>
        </h1>
      </div>

      {/* SEARCH */}
      <div className="relative px-4 mt-6">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full p-4 rounded-2xl bg-black/60"
        />
      </div>

      {/* RESULTS */}
      <div className="relative px-4 mt-6 space-y-3">

        {loading && <p>Buscando...</p>}

        {results.map(song => (

          <div key={song.youtubeId} className="flex gap-3 p-3 bg-black/60 rounded-xl">

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-16 h-16 rounded-xl"
            />

            <div className="flex-1">
              <p>{song.title}</p>
              <p className="text-sm text-zinc-400">{song.artist}</p>
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

      {/* FOOTER */}
      <div className="absolute bottom-3 w-full text-center text-zinc-500">
        Cola global: {queue.length}
      </div>

    </div>

  )
}

export default MobilePage