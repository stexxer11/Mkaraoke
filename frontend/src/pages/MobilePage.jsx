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
    registerUser,
    getUser // 👈 SOLO AGREGADO (NECESARIO)
  } = useKaraoke()

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
  // RULES (NO TOCADO)
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
      s =>
        s.ownerId === deviceId &&
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
  // 🔥 FIX USER CONTROL (CORREGIDO)
  // =========================
  useEffect(() => {

    if (loadingUser) return

    const init = async () => {

      try {
        const u = await getUser(deviceId)

        if (u?.artistName) {
          setUserReady(true)
          setForceRegister(false)
          return
        }

      } catch (err) {
        // 👇 SOLO SI NO EXISTE
        if (!alertShown.current) {

          alertShown.current = true
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

              if (!value || !value.trim()) {
                Swal.showValidationMessage("Ingresa un nombre válido")
                return false
              }

              try {
                await registerUser(value.trim())

                // 🔥 recargar usuario REAL desde backend
                const newUser = await getUser(deviceId)

                if (newUser?.artistName) {
                  setUserReady(true)
                  setForceRegister(false)
                  alertShown.current = false
                  return true
                }

              } catch (e) {
                Swal.showValidationMessage("Error creando usuario")
                return false
              }
            }
          })
        }
      }
    }

    init()

  }, [deviceId, loadingUser])

  // =========================
  // KARAOKE FILTER (NO TOCADO)
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
  // SEARCH (NO TOCADO)
  // =========================
  const debouncedSearch = useMemo(() =>
    debounce(async (value) => {

      if (!value || value.trim().length < RULES.MIN_SEARCH_LENGTH) {
        setResults([])
        return
      }

      const now = Date.now()

      if (now - lastSearch.current < RULES.SEARCH_COOLDOWN_MS) {
        return
      }

      lastSearch.current = now

      setLoading(true)

      try {

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
  // ACTIONS (NO TOCADO)
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
  }

  // =========================
  // MY SONG STATE (NO TOCADO)
  // =========================
  const mySongs = useMemo(() =>
    queue.filter(song =>
      song.ownerId === deviceId &&
      song.status !== "done" &&
      song.status !== "cancelled"
    )
  , [queue, deviceId])

  const myActiveSong = useMemo(() =>
    mySongs[0] || null
  , [mySongs])

  const isMySongPlaying =
    currentSong?.id === myActiveSong?.id

  // =========================
  // ALERT SYSTEM (NO TOCADO)
  // =========================
  useEffect(() => {

    if (!myActiveSong) return

    const alertKey =
      `${myActiveSong.id}-${currentSong?.id}`

    if (alertOpen.current === alertKey) return

    alertOpen.current = alertKey

    if (isMySongPlaying) {

      Swal.fire({
        title: "Disfruta tu canción 🎤",
        html: `<b>${myActiveSong.title}</b>`,
        background: "#000",
        color: "#06b6d4",
        showConfirmButton: false
      })

      return
    }

    showAlert({
      title: "Tu turno 🎤",
      html: `<b>${myActiveSong.title}</b>`,
      background: "#000",
      color: "#06b6d4",
      showConfirmButton: false
    })

  }, [
    queue,
    currentSong,
    myActiveSong,
    isMySongPlaying
  ])

  // =========================
  // UI BLOCK
  // =========================
  if (loadingUser || forceRegister || !userReady) {

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Inicializando sistema...
      </div>
    )
  }

  // =========================
  // UI (NO TOCADO)
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
              className="px-4 py-2 bg-cyan-500 text-black rounded-lg"
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

      <div className="fixed bottom-0 w-full bg-black/90 text-center py-3 text-zinc-500 border-t border-zinc-800">
        Cola global: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage