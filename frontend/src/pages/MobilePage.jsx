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
  const userId = user?.id

  // =========================
  // DEBUG USER
  // =========================
  useEffect(() => {

    console.log("========== DEBUG USER ==========")

    console.log("loadingUser:", loadingUser)

    console.log("session:", session)

    console.log("session.user:", session?.user)

    console.log("session.user.id:", session?.user?.id)

    console.log("user DB/context:", user)

    console.log("user.id:", user?.id)

    console.log("artist_name:", user?.artist_name)

    console.log("artistName:", user?.artistName)

    console.log(
      "READY SESSION:",
      !!session?.user?.id
    )

    console.log(
      "READY USER:",
      !!user
    )

    console.log(
      "USER EXISTS IN DB:",
      !!user?.id
    )

    console.log(
      "HAS ARTIST NAME:",
      !!(user?.artist_name || user?.artistName)
    )

    console.log("================================")

  }, [session, user, loadingUser])

  // =========================
  // DEBUG QUEUE
  // =========================
  useEffect(() => {

    console.log("========== DEBUG QUEUE ==========")

    console.log("queue:", queue)

    console.log("userId:", userId)

    console.log(
      "mySongs:",
      queue.filter(s => s.owner_id === userId)
    )

    console.log("=================================")

  }, [queue, userId])

  // =========================
  // STATE
  // =========================
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

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
  // INIT APP
  // =========================
  const isAppReady = useMemo(() => {

    const ready =
      !loadingUser &&
      !!session?.user?.id &&
      !!user

    console.log("APP READY:", ready)

    return ready

  }, [loadingUser, session, user])

  // =========================
  // NEW USER FLOW
  // =========================
  // =========================
// NEW USER FLOW
// =========================
useEffect(() => {

  console.log("CHECKING NEW USER FLOW")

  // render/supabase todavía cargando
  if (loadingUser) {

    console.log(
      "STOP: loadingUser = true"
    )

    return
  }

  // debug session
  console.log(
    "SESSION TYPE:",
    typeof session
  )

  console.log(
    "SESSION EXISTS:",
    !!session
  )

  console.log(
    "SESSION USER ID:",
    session?.user?.id
  )

  // IMPORTANTE:
  // render free puede tardar en despertar
  // así que esperamos session real
  if (!session?.user?.id) {

    console.log(
      "SESSION NOT READY YET..."
    )

    // debug extra
    if (user?.id) {

      console.log(
        "USER EXISTS IN DB BUT SESSION STILL SLEEPING"
      )

      console.log(
        "LIKELY RENDER COLD START"
      )
    }

    return
  }

  // no hay user todavía
  if (!user) {

    console.log(
      "STOP: no user in DB/context"
    )

    return
  }

  // detectar nombre artista
  const hasName =
    user.artist_name ||
    user.artistName

  console.log(
    "HAS NAME:",
    hasName
  )

  // ya tiene nombre
  if (hasName) {

    console.log(
      "USER ALREADY CONFIGURED"
    )

    return
  }

  // evitar doble modal
  if (alertShown.current) {

    console.log(
      "ALERT ALREADY SHOWN"
    )

    return
  }

  console.log(
    "SHOWING REGISTER MODAL"
  )

  alertShown.current = true

  Swal.fire({
    title: "Bienvenido nuevo artista 🎤",
    text: "Debes crear tu nombre único para continuar",

    input: "text",

    inputPlaceholder: "Ej: DJ Rolando",

    background: "#000",
    color: "#06b6d4",

    allowOutsideClick: false,
    allowEscapeKey: false,

    confirmButtonText: "Crear usuario",

    preConfirm: async (value) => {

      const artistName =
        value?.trim()

      console.log(
        "ARTIST INPUT:",
        artistName
      )

      if (!artistName) {

        Swal.showValidationMessage(
          "Ingresa un nombre válido"
        )

        return false
      }

      try {

        console.log(
          "REGISTERING USER..."
        )

        const result =
          await registerUser(artistName)

        console.log(
          "REGISTER SUCCESS:",
          result
        )

        return true

      } catch (error) {

        console.error(
          "REGISTER ERROR:",
          error
        )

        Swal.showValidationMessage(
          error?.message ||
          "Error creando usuario"
        )

        return false
      }
    }
  })

}, [
  session,
  loadingUser,
  user,
  registerUser
])

  // =========================
  // LOADING GATE
  // =========================
  if (!isAppReady) {

    console.log("WAITING APP READY...")

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Inicializando sistema...
      </div>
    )
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
      "backing track"
    ]

    return keywords.some(k =>
      text.toLowerCase().includes(k)
    )
  }

  const forceKaraokeQuery = (text) =>
    isKaraokeQuery(text)
      ? text
      : `${text} karaoke instrumental lyrics`

  // =========================
  // SEARCH
  // =========================
  const debouncedSearch = useMemo(() =>
    debounce(async (value) => {

      console.log("SEARCH:", value)

      if (!value || value.trim().length < RULES.MIN_SEARCH_LENGTH) {

        console.log("SEARCH TOO SHORT")

        setResults([])
        return
      }

      if (
        Date.now() - lastSearch.current <
        RULES.SEARCH_COOLDOWN_MS
      ) {
        console.log("SEARCH COOLDOWN ACTIVE")
        return
      }

      lastSearch.current = Date.now()

      setLoading(true)

      try {

        const finalQuery =
          forceKaraokeQuery(value)

        console.log("FINAL QUERY:", finalQuery)

        const data =
          await searchYouTube(finalQuery)

        console.log("YOUTUBE RESULTS:", data)

        setResults(data || [])

      } catch (error) {

        console.error(
          "YOUTUBE SEARCH ERROR:",
          error
        )

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

    console.log("INPUT SEARCH:", value)

    setSearch(value)
    debouncedSearch(value)
  }

  // =========================
  // SONG ACTIONS
  // =========================
  const handleAddSong = async (song) => {

    console.log("ADDING SONG:", song)

    if (queue.length >= RULES.MAX_GLOBAL_QUEUE) {

      console.log("QUEUE FULL")

      return
    }

    const mySongs = queue.filter(
      s =>
        s.owner_id === userId &&
        s.status !== "done" &&
        s.status !== "cancelled"
    )

    console.log("MY ACTIVE SONGS:", mySongs)

    if (mySongs.length >= RULES.MAX_QUEUE_PER_USER) {

      console.log("USER LIMIT REACHED")

      return Swal.fire({
        icon: "warning",
        title: "Límite alcanzado",
        text: "Solo puedes tener 1 canción en cola",
        background: "#000",
        color: "#06b6d4"
      })
    }

    if (queue.some(s =>
      s.youtubeId === song.youtubeId &&
      s.owner_id === userId &&
      s.status !== "done" &&
      s.status !== "cancelled"
    )) {

      console.log("DUPLICATE SONG")

      return Swal.fire({
        icon: "warning",
        title: "Canción duplicada",
        text: "Ya agregaste esta canción",
        background: "#000",
        color: "#06b6d4"
      })
    }

    try {

      await addSong(song)

      console.log("SONG ADDED SUCCESS")

      setSearch("")
      setResults([])

    } catch (error) {

      console.error(
        "ADD SONG ERROR:",
        error
      )
    }
  }

  const handleReplaceSong = async (song) => {

    console.log("REPLACING SONG:", song)

    if (!editSongData) {
      console.log("NO editSongData")
      return
    }

    if (currentSong?.id === editSongData.id) {
      console.log("CANNOT EDIT CURRENT SONG")
      return
    }

    try {

      await editSong(editSongData.id, song)

      console.log("SONG REPLACED")

      setEditMode(false)
      setEditSongData(null)

      setSearch("")
      setResults([])

    } catch (error) {

      console.error(
        "EDIT SONG ERROR:",
        error
      )
    }
  }

  // =========================
  // USER SONGS
  // =========================
  const mySongs = useMemo(() =>
    queue.filter(song =>
      song.owner_id === userId &&
      song.status !== "done" &&
      song.status !== "cancelled"
    )
  , [queue, userId])

  const myActiveSong = useMemo(() =>
    mySongs[0] || null
  , [mySongs])

  const isMySongPlaying =
    currentSong?.id === myActiveSong?.id

  // =========================
  // ALERTS
  // =========================
  useEffect(() => {

    console.log("ALERT CHECK")

    if (!myActiveSong) {
      console.log("NO ACTIVE SONG")
      return
    }

    const alertKey =
      `${myActiveSong.id}-${currentSong?.id}`

    if (alertOpen.current === alertKey) {
      console.log("ALERT ALREADY OPEN")
      return
    }

    alertOpen.current = alertKey

    console.log(
      "SHOW ALERT FOR:",
      myActiveSong
    )

    if (isMySongPlaying) {

      Swal.fire({
        title: "Disfruta tu canción 🎤",
        html: `<b>${myActiveSong.title}</b>`,
        background: "#000",
        color: "#06b6d4",
        showConfirmButton: false,
        timer: 3000
      })

      return
    }

    Swal.fire({
      title: "Tu turno 🎤",
      html: `<b>${myActiveSong.title}</b>`,
      background: "#000",
      color: "#06b6d4",
      showConfirmButton: false,
      timer: 3000
    })

  }, [queue, currentSong, myActiveSong, isMySongPlaying])

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-black text-white relative pb-24 overflow-y-auto">

      <div className="text-center pt-4 text-zinc-400 text-sm">
        Bienvenido, {user?.artist_name || "Artista"}
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
          <p className="text-zinc-400">
            Buscando...
          </p>
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
              <p className="font-bold text-sm">
                {song.title}
              </p>

              <p className="text-xs text-zinc-400">
                {song.artist}
              </p>
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