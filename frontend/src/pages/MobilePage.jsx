import { useState, useEffect, useRef, useMemo } from "react"
import debounce from "lodash.debounce"

import { useKaraoke } from "../context/KaraokeContext"
import Swal from "sweetalert2"
import { searchYouTube } from "../services/youtubeApi"

function MobilePage() {

  const {
    queue,
    addSong,
    editSong,
    deviceId,
    currentSong,
  } = useKaraoke()

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const alertOpen = useRef(null)

  // =========================
  // SEARCH
  // =========================
  const debouncedSearch = useMemo(
    () =>
      debounce(async (value) => {

        if (!value || value.trim().length < 3) {
          setResults([])
          return
        }

        setLoading(true)

        try {
          const data = await searchYouTube(value)
          setResults(data || [])
        } catch (err) {
          console.log(err)
          setResults([])
        }

        setLoading(false)

      }, 700),
    []
  )

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // =========================
  // 🔥 STORE TURN SYSTEM (REAL)
  // =========================
  const mySongs = queue.filter(s => s.ownerId === deviceId)

  const myQueueIndex = useMemo(() => {
    if (!currentSong) return -1
    return mySongs.findIndex(s => s.id === currentSong.id)
  }, [currentSong, mySongs])

  const isMyTurn = myQueueIndex !== -1
  const turnsLeft = myQueueIndex

  const isMySongPlaying =
    isMyTurn &&
    currentSong?.id === mySongs[myQueueIndex]?.id

  // =========================
  // ALERT SYSTEM (STABLE)
  // =========================
  useEffect(() => {

    if (!currentSong) {
      alertOpen.current = null
      if (Swal.isVisible()) Swal.close()
      return
    }

    if (alertOpen.current === currentSong.id) return
    alertOpen.current = currentSong.id

    // =========================
    // 1. MY SONG PLAYING
    // =========================
    if (isMySongPlaying) {

      Swal.fire({
        title: "Disfruta tu canción 🎤",
        html: `
          <div style="font-size:16px;text-align:center">
            <b style="font-size:18px">${currentSong.title}</b><br/>
            <span style="color:#22d3ee">Estás en pantalla ahora</span>
          </div>
        `,
        background: "#000",
        color: "#06b6d4",
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })

      return
    }

    // =========================
    // 2. NOT YOUR TURN
    // =========================
    if (!isMyTurn) {

      Swal.fire({
        title: "Tu canción está en cola",
        html: `
          <div style="font-size:16px;text-align:center">
            <b>${currentSong.title}</b><br/>
            <span style="color:#9ca3af">
              Te faltan ${Math.max(turnsLeft, 0)} turnos
            </span>
          </div>
        `,
        background: "#000",
        color: "#06b6d4",
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })

      return
    }

    // =========================
    // 3. YOUR TURN READY
    // =========================
    Swal.fire({
      title: "Tu turno está activo 🎤",
      html: `
        <div style="font-size:16px;text-align:center">
          <b style="font-size:18px">${currentSong.title}</b><br/>
          <span style="color:#22d3ee">Puedes prepararte</span>
        </div>
      `,
      background: "#000",
      color: "#06b6d4",
      showDenyButton: true,
      denyButtonText: "Editar canción",
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(res => {

      if (res.isDenied) {
        setEditMode(true)
        setEditSongData(currentSong)
        setSearch("")
        setResults([])
        alertOpen.current = null
      }
    })

  }, [currentSong, queue])

  // =========================
  // ADD SONG (STORE SAFE)
  // =========================
  const handleAddSong = (song) => {

    if (mySongs.length > 0) {

      Swal.fire({
        icon: "warning",
        title: "Ya tienes una canción en cola",
        toast: true,
        timer: 2000,
        position: "top-end"
      })

      return
    }

    addSong({
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId,
    })
  }

  // =========================
  // REPLACE SONG (EDIT SAFE)
  // =========================
  const handleReplaceSong = (song) => {

    if (!editSongData) return

    editSong(editSongData.id, {
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId
    })

    setEditMode(false)
    setEditSongData(null)

    setSearch("")
    setResults([])

    Swal.fire({
      icon: "success",
      title: "Canción actualizada",
      toast: true,
      timer: 1500,
      position: "top-end",
      showConfirmButton: false
    })
  }

  return (
    <div className="min-h-screen text-white flex flex-col">

      {/* HEADER */}
      <div className="p-5 glass border-b border-white/10">

        <h1 className="text-3xl font-bold text-cyan-400 glow-cyan">
          MKaraoke
        </h1>

        <p className="text-zinc-400">
          Busca tu canción en YouTube
        </p>

      </div>

      {/* EDIT MODE */}
      {editMode && (
        <div className="p-3 border-b border-white/10 glass">

          <input
            className="w-full p-2 rounded-lg bg-zinc-900 text-sm outline-none"
            placeholder="Buscar reemplazo..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />

        </div>
      )}

      {/* SEARCH */}
      {!editMode && (
        <div className="p-5">

          <input
            className="w-full p-3 rounded-xl glass border border-white/10 outline-none"
            placeholder="Buscar en YouTube..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />

        </div>
      )}

      {/* RESULTS */}
      <div className="flex-1 p-5 space-y-4 overflow-y-auto">

        {loading && (
          <p className="text-zinc-500">
            Buscando en YouTube...
          </p>
        )}

        {results.map(song => (

          <div
            key={song.youtubeId}
            className="glass tap glow-cyan p-3 rounded-2xl flex gap-4 items-center"
          >

            <div className="w-20 h-20 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0">

              <img
                src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
                className="w-full h-full object-cover"
              />

            </div>

            <div className="flex-1 min-w-0">

              <p className="font-bold truncate">
                {song.title}
              </p>

              <p className="text-zinc-400 text-sm truncate">
                {song.artist}
              </p>

              <p className="text-cyan-400/60 text-xs mt-1">
                🎤 disponible
              </p>

            </div>

            <button
              onClick={() =>
                editMode
                  ? handleReplaceSong(song)
                  : handleAddSong(song)
              }
              className="tap bg-cyan-500 text-black px-4 py-2 rounded-xl font-bold"
            >
              +
            </button>

          </div>

        ))}

      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-white/10 glass text-center text-zinc-400">
        Cola global: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage