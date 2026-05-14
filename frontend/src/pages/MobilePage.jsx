import { useState, useEffect, useRef, useMemo } from "react"
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
    user,
    loadingUser,
    registerUser,
  } = useKaraoke()

  // =========================
  // STATE LOCAL
  // =========================
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const alertOpen = useRef(null)
  const lastSearch = useRef(0)
  const alertShown = useRef(false)

  const userId = user?.id

  // =========================
  // PHASE (CLAVE DEL FIX)
  // =========================
  const appPhase = useMemo(() => {
    if (loadingUser) return "booting"
    if (!user) return "onboarding"
    return "ready"
  }, [loadingUser, user])

  // =========================
  // ONBOARDING (SOLO UNA VEZ)
  // =========================
  useEffect(() => {
    if (appPhase !== "onboarding") return
    if (alertShown.current) return

    alertShown.current = true

    Swal.fire({
      title: "Bienvenido nuevo artista 🎤",
      text: "Crea tu nombre para continuar",
      input: "text",
      inputPlaceholder: "Ej: DJ Rolando",
      background: "#000",
      color: "#06b6d4",
      allowOutsideClick: false,
      allowEscapeKey: false,
      confirmButtonText: "Crear usuario",

      preConfirm: async (value) => {
        const name = value?.trim()

        if (!name) {
          Swal.showValidationMessage("Nombre inválido")
          return false
        }

        try {
          await registerUser(name)
          return true
        } catch (err) {
          Swal.showValidationMessage("Error creando usuario")
          return false
        }
      },
    })
  }, [appPhase])

  // =========================
  // LOADING / GATES
  // =========================
  if (appPhase === "booting") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Inicializando sistema...
      </div>
    )
  }

  if (appPhase === "onboarding") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Creando perfil...
      </div>
    )
  }

  // =========================
  // CONSTANTES
  // =========================
  const RULES = {
    MIN_SEARCH_LENGTH: 3,
    MAX_QUEUE_PER_USER: 1,
    MAX_GLOBAL_QUEUE: 50,
    SEARCH_COOLDOWN_MS: 1500,
  }

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
      "backing track",
    ]

    return keywords.some((k) =>
      text.toLowerCase().includes(k)
    )
  }

  const forceKaraokeQuery = (text) =>
    isKaraokeQuery(text)
      ? text
      : `${text} karaoke instrumental lyrics`

  // =========================
  // SEARCH (DEBOUNCE)
  // =========================
  const debouncedSearch = useMemo(
    () =>
      debounce(async (value) => {
        if (!value || value.trim().length < RULES.MIN_SEARCH_LENGTH) {
          setResults([])
          return
        }

        if (Date.now() - lastSearch.current < RULES.SEARCH_COOLDOWN_MS) return

        lastSearch.current = Date.now()
        setLoading(true)

        try {
          const data = await searchYouTube(forceKaraokeQuery(value))
          setResults(data || [])
        } catch {
          setResults([])
        } finally {
          setLoading(false)
        }
      }, 600),
    []
  )

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  // =========================
  // SONG ACTIONS
  // =========================
  const handleAddSong = async (song) => {
    if (queue.length >= RULES.MAX_GLOBAL_QUEUE) return

    const mySongs = queue.filter(
      (s) =>
        s.owner_id === userId &&
        s.status !== "done" &&
        s.status !== "cancelled"
    )

    if (mySongs.length >= RULES.MAX_QUEUE_PER_USER) {
      return Swal.fire({
        icon: "warning",
        title: "Límite alcanzado",
        text: "Solo puedes tener 1 canción en cola",
        background: "#000",
        color: "#06b6d4",
      })
    }

    if (
      queue.some(
        (s) =>
          s.youtubeId === song.youtubeId &&
          s.owner_id === userId &&
          s.status !== "done" &&
          s.status !== "cancelled"
      )
    ) {
      return Swal.fire({
        icon: "warning",
        title: "Duplicada",
        text: "Ya agregaste esta canción",
        background: "#000",
        color: "#06b6d4",
      })
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

  // =========================
  // DERIVADOS
  // =========================
  const mySongs = useMemo(
    () =>
      queue.filter(
        (s) =>
          s.owner_id === userId &&
          s.status !== "done" &&
          s.status !== "cancelled"
      ),
    [queue, userId]
  )

  const myActiveSong = mySongs[0] || null

  const isMySongPlaying =
    currentSong?.id === myActiveSong?.id

  // =========================
  // ALERTS
  // =========================
  useEffect(() => {
    if (!myActiveSong) return

    const key = `${myActiveSong.id}-${currentSong?.id}`

    if (alertOpen.current === key) return
    alertOpen.current = key

    Swal.fire({
      title: isMySongPlaying
        ? "Disfruta tu canción 🎤"
        : "Tu turno 🎤",
      html: `<b>${myActiveSong.title}</b>`,
      background: "#000",
      color: "#06b6d4",
      timer: 3000,
      showConfirmButton: false,
    })
  }, [queue, currentSong, myActiveSong, isMySongPlaying])

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-black text-white pb-24">

      <div className="text-center pt-4 text-zinc-400 text-sm">
        Bienvenido, {user?.artist_name}
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

        {results.map((song) => (
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