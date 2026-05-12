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

// =========================
// RULES ENGINE
// =========================

const RULES = {
  MIN_SEARCH_LENGTH: 3,
  MAX_QUEUE_PER_USER: 1,
  MAX_GLOBAL_QUEUE: 50,
  SEARCH_COOLDOWN_MS: 1500,
}

const isDuplicateSong = (queue, youtubeId, deviceId) => {
  return queue.some(
    s =>
      s.youtubeId === youtubeId &&
      s.ownerId === deviceId &&
      s.status !== "done" &&
      s.status !== "cancelled"
  )
}

const canAddSong = (queue, deviceId) => {
  const mySongs = queue.filter(
    s => s.ownerId === deviceId && s.status !== "done" && s.status !== "cancelled"
  )
  return mySongs.length < RULES.MAX_QUEUE_PER_USER
}

const isQueueFull = (queue) => queue.length >= RULES.MAX_GLOBAL_QUEUE

const showAlert = (config) => {
  if (Swal.isVisible()) return
  return Swal.fire(config)
}

// =========================
// COMPONENT
// =========================

function MobilePage() {

  const {
    queue,
    addSong,
    editSong,
    cancelSong,
    deviceId,
    currentSong,
  } = useKaraoke()

  // =========================
  // STATES
  // =========================

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const alertOpen = useRef(null)
  const lastSearch = useRef(0)

  // =========================
  // SEARCH CONTROLLED
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

  // =========================
  // MY SONGS LOGIC
  // =========================

  const mySongs = useMemo(() => {
    return queue.filter(song =>
      song.ownerId === deviceId &&
      song.status !== "done" &&
      song.status !== "cancelled"
    )
  }, [queue, deviceId])

  const myActiveSong = useMemo(() => mySongs[0] || null, [mySongs])

  const turnsLeft = useMemo(() => {

    if (!myActiveSong) return -1

    const activeQueue = queue.filter(song =>
      song.status === "queued" ||
      song.status === "playing"
    )

    return activeQueue.findIndex(song =>
      song.id === myActiveSong.id
    )

  }, [queue, myActiveSong])

  const isMyTurn = turnsLeft === 0
  const isMySongPlaying = currentSong?.id === myActiveSong?.id

  // =========================
  // AUTO CLOSE EDIT
  // =========================

  useEffect(() => {

    if (isMySongPlaying && editMode) {
      setEditMode(false)
      setEditSongData(null)
      setSearch("")
      setResults([])
    }

  }, [isMySongPlaying, editMode])

  // =========================
  // ALERT SYSTEM CONTROLLED
  // =========================

  useEffect(() => {

    if (!myActiveSong || !queue.length) {
      if (Swal.isVisible()) Swal.close()
      alertOpen.current = null
      return
    }

    const alertKey =
      `${myActiveSong.id}-${turnsLeft}-${currentSong?.id}`

    if (alertOpen.current === alertKey) return

    alertOpen.current = alertKey

    // =====================
    // PLAYING
    // =====================

    if (isMySongPlaying) {

      showAlert({
        title: "Disfruta tu canción 🎤",
        html: `
          <div style="text-align:center;font-size:16px;">
            <b style="font-size:20px;color:#22d3ee;">
              ${myActiveSong.title}
            </b>
            <br/><br/>
            <span style="color:#d4d4d8;">
              Tu canción ya está sonando
            </span>
          </div>
        `,
        background: "#000",
        color: "#06b6d4",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
      })

      return
    }

    // =====================
    // TURN READY / WAITING
    // =====================

    const isReady = isMyTurn

    showAlert({
      title: isReady ? "Tu turno está listo 🎤" : "Tu canción está en cola",
      html: `
        <div style="text-align:center;font-size:16px;">
          <b style="font-size:20px;color:#22d3ee;">
            ${myActiveSong.title}
          </b>
          <br/><br/>
          ${
            isReady
              ? `<span style="color:#d4d4d8;">Prepárate, eres el siguiente</span>`
              : `<span style="color:#a1a1aa;">Te faltan <b style="color:white">${turnsLeft}</b> turnos</span>`
          }
        </div>
      `,
      background: "#000",
      color: "#06b6d4",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
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
          text: "Tu turno será eliminado",
          icon: "warning",
          background: "#000",
          color: "#06b6d4",
          showCancelButton: true,
          confirmButtonText: "Sí, cancelar",
          cancelButtonText: "Volver",
        }).then(async confirm => {

          if (confirm.isConfirmed) {
            await cancelSong(myActiveSong.id)

            showAlert({
              icon: "success",
              title: "Turno cancelado",
              toast: true,
              position: "top-end",
              timer: 2000,
              showConfirmButton: false,
              background: "#000",
              color: "#06b6d4",
            })
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

  // =========================
  // ADD SONG RULES
  // =========================

  const handleAddSong = async (song) => {

    if (isQueueFull(queue)) {
      showAlert({
        icon: "error",
        title: "Cola llena",
        text: "La cola global alcanzó el límite",
        background: "#000",
        color: "#06b6d4",
      })
      return
    }

    if (!canAddSong(queue, deviceId)) {
      showAlert({
        icon: "warning",
        title: "Ya tienes una canción",
        text: "Debes esperar tu turno",
        toast: true,
        position: "top-end",
        timer: 2000,
        showConfirmButton: false,
        background: "#000",
        color: "#06b6d4",
      })
      return
    }

    if (isDuplicateSong(queue, song.youtubeId, deviceId)) {
      showAlert({
        icon: "info",
        title: "Canción duplicada",
        text: "Ya agregaste esta canción",
        toast: true,
        position: "top-end",
        timer: 2000,
        showConfirmButton: false,
        background: "#000",
        color: "#06b6d4",
      })
      return
    }

    await addSong({
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId,
    })

    setSearch("")
    setResults([])
  }

  // =========================
  // REPLACE SONG RULES
  // =========================

  const handleReplaceSong = async (song) => {

    if (!editSongData) return

    if (currentSong?.id === editSongData.id) {
      showAlert({
        icon: "error",
        title: "No permitido",
        text: "No puedes editar una canción en reproducción",
        background: "#000",
        color: "#06b6d4",
      })
      return
    }

    await editSong(editSongData.id, {
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId,
    })

    setEditMode(false)
    setEditSongData(null)
    setSearch("")
    setResults([])
  }

  // =========================
  // RENDER
  // =========================

  return (

    <div className="min-h-screen bg-black overflow-hidden relative text-white">

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[700px] h-[700px] bg-cyan-500/10 blur-3xl rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative z-10 text-center pt-10">

        <h1 className="text-6xl font-black tracking-tight drop-shadow-2xl">
          M<span className="text-cyan-400">KARAOKE</span>
        </h1>

        <p className="text-zinc-400 text-lg mt-2">
          Busca y agrega tu canción
        </p>

      </div>

      <div className="relative z-10 px-4 mt-6">

        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={editMode ? "Buscar reemplazo..." : "Buscar canción..."}
          className="w-full px-4 py-4 rounded-2xl bg-black/60 border border-cyan-500/20 backdrop-blur-xl text-white outline-none focus:border-cyan-400/60 focus:shadow-[0_0_25px_rgba(34,211,238,0.25)]"
        />

      </div>

      <div className="relative z-10 px-4 mt-6 space-y-3">

        {loading && <p className="text-zinc-400">Buscando...</p>}

        {results.map(song => (
          <div
            key={song.youtubeId}
            className="flex items-center gap-3 p-3 rounded-2xl bg-black/60 border border-cyan-500/15 backdrop-blur-xl"
          >

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-16 h-16 rounded-xl object-cover"
            />

            <div className="flex-1">
              <p className="font-bold">{song.title}</p>
              <p className="text-sm text-zinc-400">{song.artist}</p>
            </div>

            <button
              className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-300 font-bold"
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

      <div className="absolute bottom-3 w-full text-center text-zinc-500 text-sm">
        Cola global: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage