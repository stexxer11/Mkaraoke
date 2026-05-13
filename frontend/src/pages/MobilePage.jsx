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
import { supabase } from "../supabaseClient"

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

  // ================= USER STATE =================
  const [username, setUsername] = useState("")
  const [userLoaded, setUserLoaded] = useState(false)
  const [isFirstTime, setIsFirstTime] = useState(false)

  // ================= ALERT REF =================
  const welcomeShown = useRef(false)

  // ================= INIT USER =================
  useEffect(() => {

    const initUser = async () => {
      if (!deviceId) return

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("device_id", deviceId)
        .maybeSingle()

      // ================= FIRST TIME USER =================
      if (!data) {

        setIsFirstTime(true)

        const { value: name } = await Swal.fire({
          title: "🎤 Bienvenido al Karaoke",
          text: "Ingresa tu nombre artístico",
          input: "text",
          inputPlaceholder: "Ej: DJ Rolando",
          background: "#000",
          color: "#06b6d4",
          confirmButtonText: "Entrar",
          allowOutsideClick: false
        })

        if (name) {

          await supabase
            .from("users")
            .insert([
              {
                device_id: deviceId,
                name: name
              }
            ])

          setUsername(name)
          setUserLoaded(true)

          Swal.fire({
            title: "Listo 🎉",
            text: `Prepárate para brillar, ${name}`,
            background: "#000",
            color: "#06b6d4",
            timer: 2000,
            showConfirmButton: false
          })
        }

        return
      }

      // ================= USER EXISTS =================
      setUsername(data.name)
      setUserLoaded(true)

      if (!welcomeShown.current) {
        welcomeShown.current = true

        Swal.fire({
          title: "😂 Bienvenido de nuevo artista",
          html: `<b>Hola ${data.name}</b><br/>el escenario te extrañaba`,
          background: "#000",
          color: "#06b6d4",
          showConfirmButton: false,
          timer: 2200
        })
      }
    }

    initUser()
  }, [deviceId])

  // ================= SONG RULES =================
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

  // ================= KARAOKE FILTER =================
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

  // ================= SEARCH =================
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

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // ================= MY SONG =================
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

  // ================= ALERT SYSTEM =================
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

      showConfirmButton: false,
      showDenyButton: true,
      denyButtonText: "Editar canción",

      showCancelButton: true,
      cancelButtonText: "Cancelar",
    }).then(res => {

      if (res.isDenied) {
        setEditMode(true)
        setEditSongData(myActiveSong)
      }

      if (res.dismiss === Swal.DismissReason.cancel) {
        cancelSong(myActiveSong.id)
      }

    })

  }, [
    queue,
    currentSong,
    myActiveSong,
    isMyTurn,
    isMySongPlaying,
    deviceId,
    editMode
  ])

  // ================= ADD SONG =================
  const handleAddSong = async (song) => {

    if (isQueueFull(queue)) return
    if (!canAddSong(queue, deviceId)) return
    if (isDuplicateSong(queue, song.youtubeId, deviceId)) return

    await addSong({
      ...song,
      ownerId: deviceId,
      owner_name: username
    })

    setSearch("")
    setResults([])
  }

  // ================= UI =================
  return (
    <div className="min-h-screen bg-black text-white pb-24">

      <div className="text-center pt-8">
        <h1 className="text-4xl font-black">
          M<span className="text-cyan-400">KARAOKE</span>
        </h1>
      </div>

      <div className="text-center mt-3">
        {userLoaded && (
          <h2 className="text-cyan-400 font-bold">
            Hola artista {username} 🎤
          </h2>
        )}
      </div>

      <div className="px-4 mt-5">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar canción..."
          className="w-full p-3 bg-black border border-cyan-500"
        />
      </div>

      <div className="px-4 mt-4 space-y-3">

        {loading && <p>Cargando...</p>}

        {results.map(song => (
          <div key={song.youtubeId} className="flex gap-3 p-2 bg-zinc-900">

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-12 h-12"
            />

            <div className="flex-1">
              <p>{song.title}</p>
              <p className="text-xs text-zinc-400">{song.artist}</p>
            </div>

            <button
              onClick={() => handleAddSong(song)}
              className="bg-cyan-500 px-3 text-black"
            >
              +
            </button>

          </div>
        ))}

      </div>

    </div>
  )
}

export default MobilePage