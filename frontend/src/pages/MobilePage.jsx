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

  const welcomeShown = useRef(false)
  const userInitDone = useRef(false)

  // ================= INIT USER =================
  useEffect(() => {

    const initUser = async () => {
      if (!deviceId) return
      if (userInitDone.current) return

      userInitDone.current = true

      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("device_id", deviceId)
          .maybeSingle()

        if (error) throw error

        // ================= FIRST TIME USER =================
        if (!data) {

          const { value: name } = await Swal.fire({
            title: "🎤 Bienvenido al Karaoke",
            text: "Ingresa tu nombre artístico",
            input: "text",
            inputPlaceholder: "Ej: DJ Rolando",
            background: "#000",
            color: "#06b6d4",
            confirmButtonText: "Entrar",
            allowOutsideClick: false,
            allowEscapeKey: false
          })

          if (!name) return

          const { error: insertError } = await supabase
            .from("users")
            .insert([
              {
                device_id: deviceId,
                name: name.trim()
              }
            ])

          if (insertError) throw insertError

          setUsername(name.trim())
          setUserLoaded(true)

          Swal.fire({
            title: "Listo 🎉",
            text: `Bienvenido ${name}`,
            background: "#000",
            color: "#06b6d4",
            timer: 1800,
            showConfirmButton: false
          })

          return
        }

        // ================= USER EXISTS =================
        setUsername(data.name)
        setUserLoaded(true)

        if (!welcomeShown.current) {
          welcomeShown.current = true

          Swal.fire({
            title: "😂 Bienvenido de nuevo artista",
            html: `<b>Hola ${data.name}</b><br/>el escenario te espera`,
            background: "#000",
            color: "#06b6d4",
            timer: 2000,
            showConfirmButton: false
          })
        }

      } catch (err) {
        console.error("USER INIT ERROR:", err)

        setUserLoaded(true)
        setUsername("Artista")
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

  // ================= SEARCH =================
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const lastSearch = useRef(0)

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

      {/* USER HEADER */}
      <div className="text-center mt-3">
        {userLoaded && (
          <h2 className="text-cyan-400 font-bold">
            Hola artista {username}
          </h2>
        )}
      </div>

      {/* SEARCH */}
      <div className="px-4 mt-5">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar canción..."
          className="w-full p-3 bg-black border border-cyan-500"
        />
      </div>

      {/* RESULTS */}
      <div className="px-4 mt-4 space-y-3">

        {loading && <p className="text-zinc-400">Buscando...</p>}

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