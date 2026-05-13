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
    currentSong,
  } = useKaraoke()

  // =====================================================
  // USER
  // =====================================================
  const [user, setUser] = useState(null)

  // FIX: deviceId estable local (NO del WS context)
  const deviceIdRef = useRef(
    localStorage.getItem("mk_device_id") || crypto.randomUUID()
  )

  useEffect(() => {

    localStorage.setItem("mk_device_id", deviceIdRef.current)

    const savedUser = localStorage.getItem("mk_user")

    if (savedUser) {
      setUser(JSON.parse(savedUser))
      return
    }

    Swal.fire({
      title: "Bienvenido a MKARAOKE",
      text: "Ingresa tu nombre para continuar",
      input: "text",
      allowOutsideClick: false,
      confirmButtonText: "Entrar",
      inputValidator: (value) => {
        if (!value) return "Debes ingresar un nombre"
      }
    }).then((result) => {

      if (!result.isConfirmed) return

      const newUser = {
        name: result.value,
        deviceId: deviceIdRef.current, // FIX ESTABLE
        createdAt: Date.now()
      }

      localStorage.setItem("mk_user", JSON.stringify(newUser))
      setUser(newUser)
    })

  }, [])

  const deviceId = user?.deviceId

  // =====================================================
  // GUARD
  // =====================================================
  if (!user || !deviceId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Cargando usuario...
      </div>
    )
  }

  // =====================================================
  // RULES
  // =====================================================
  const RULES = {
    MIN_SEARCH_LENGTH: 3,
    MAX_QUEUE_PER_USER: 1,
    MAX_GLOBAL_QUEUE: 50,
    SEARCH_COOLDOWN_MS: 1500,
  }

  const isDuplicateSong = (queue, youtubeId, ownerId) =>
    queue.some(s =>
      s.youtubeId === youtubeId &&
      s.ownerId === ownerId &&
      s.status !== "done" &&
      s.status !== "cancelled"
    )

  const canAddSong = (queue, ownerId) => {
    const mySongs = queue.filter(
      s =>
        s.ownerId === ownerId &&
        s.status !== "done" &&
        s.status !== "cancelled"
    )
    return mySongs.length < RULES.MAX_QUEUE_PER_USER
  }

  const isQueueFull = (queue) =>
    queue.length >= RULES.MAX_GLOBAL_QUEUE

  const lastSearch = useRef(0)

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

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
        const data = await searchYouTube(value + " karaoke")
        setResults(data || [])
      } catch {
        setResults([])
      }

      setLoading(false)

    }, 500)
  , [])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // =====================================================
  // MY SONGS
  // =====================================================
  const mySongs = useMemo(() => {
    return queue.filter(song =>
      song.ownerId === deviceId &&
      song.status !== "done" &&
      song.status !== "cancelled"
    )
  }, [queue, deviceId])

  // =====================================================
  // ADD SONG
  // =====================================================
  const handleAddSong = async (song) => {

    if (!deviceId) return

    if (isQueueFull(queue)) return
    if (!canAddSong(queue, deviceId)) return
    if (isDuplicateSong(queue, song.youtubeId, deviceId)) return

    await addSong({
      ...song,
      ownerId: deviceId
    })

    setSearch("")
    setResults([])
  }

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="min-h-screen bg-black text-white pb-24">

      <div className="text-center pt-8">
        <p className="text-zinc-400 text-sm">Hola, {user.name}</p>
        <h1 className="text-4xl font-black">MKARAOKE</h1>
      </div>

      <div className="px-4 mt-5">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-4 py-4 bg-black/60 border border-cyan-500/20 rounded-xl"
          placeholder="Buscar canción..."
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

            <button onClick={() => handleAddSong(song)}>
              +
            </button>

          </div>
        ))}

      </div>

      <div className="fixed bottom-0 w-full bg-black/90 text-center py-3 text-zinc-500">
        Cola global: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage