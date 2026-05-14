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
    appState,
    isBooting,
    isAuth,
    isReady,

    user,
    queue = [],

    registerUser,
    addSong,
  } = useKaraoke()

  const userId = user?.id

  // =========================
  // LOCAL STATE
  // =========================
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const alertShown = useRef(false)

  // =========================
  // BOOTSTRAP GUARDS
  // =========================
  if (isBooting) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Inicializando sistema...
      </div>
    )
  }

  // =========================
  // AUTH FLOW (SAFE ONCE)
  // =========================
  if (isAuth) {

    if (!alertShown.current) {
      alertShown.current = true

      setTimeout(() => {
        Swal.fire({
          title: "Bienvenido 🎤",
          text: "Debes crear tu nombre artístico",
          input: "text",
          background: "#000",
          color: "#06b6d4",
          allowOutsideClick: false,
          allowEscapeKey: false,
          confirmButtonText: "Crear",
          preConfirm: async (value) => {
            const name = value?.trim()

            if (!name) {
              Swal.showValidationMessage("Nombre inválido")
              return false
            }

            await registerUser(name)
          }
        })
      }, 50)
    }

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Creando usuario...
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Preparando app...
      </div>
    )
  }

  // =========================
  // SEARCH (SAFE + CLEANUP)
  // =========================
  const debouncedSearch = useMemo(() =>
    debounce(async (value) => {

      if (!value || value.trim().length < 3) {
        setResults([])
        return
      }

      setLoading(true)

      try {
        const res = await searchYouTube(value)
        setResults(res || [])
      } catch (err) {
        console.log(err)
        setResults([])
      } finally {
        setLoading(false)
      }

    }, 500)
  , [])

  useEffect(() => {
    return () => {
      debouncedSearch.cancel()
    }
  }, [debouncedSearch])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  // =========================
  // ADD SONG (SAFE)
  // =========================
  const handleAddSong = async (song) => {

    if (!song?.youtubeId) return

    try {
      await addSong(song)

      setSearch("")
      setResults([])

      Swal.fire({
        icon: "success",
        title: "Agregado 🎤",
        timer: 1200,
        showConfirmButton: false,
        background: "#000",
        color: "#06b6d4"
      })

    } catch (err) {
      console.log(err)

      Swal.fire({
        icon: "error",
        title: "Error al agregar",
        timer: 1200,
        showConfirmButton: false,
        background: "#000",
        color: "#ef4444"
      })
    }
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-black text-white pb-24">

      {/* HEADER */}
      <div className="text-center pt-4 text-sm text-zinc-400">
        Bienvenido, {user?.artist_name || "Artista"}
      </div>

      <h1 className="text-center text-4xl font-black mt-3">
        M<span className="text-cyan-400">KARAOKE</span>
      </h1>

      {/* SEARCH */}
      <div className="px-4 mt-6">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar canción..."
          className="w-full p-4 bg-black border border-cyan-500 rounded-xl outline-none"
        />
      </div>

      {/* RESULTS */}
      <div className="px-4 mt-4 space-y-3">

        {loading && (
          <p className="text-zinc-400">Buscando...</p>
        )}

        {results.map(song => (
          <div
            key={song.youtubeId}
            className="flex gap-3 p-3 bg-black/60 rounded-xl border border-zinc-800"
          >

            <img
              src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              className="w-14 h-14 rounded-lg object-cover"
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
              onClick={() => handleAddSong(song)}
              className="px-4 py-2 bg-cyan-500 text-black rounded-lg font-bold"
            >
              +
            </button>

          </div>
        ))}

      </div>

      {/* FOOTER */}
      <div className="fixed bottom-0 w-full bg-black text-center py-3 border-t border-zinc-800 text-zinc-400">
        Cola: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage