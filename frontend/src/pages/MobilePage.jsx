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

  // =========================
  // STATES
  // =========================

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const alertOpen = useRef(false)

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
  // MY SONGS (FIXED)
  // =========================

  const mySongs = useMemo(() => {
    return queue.filter(song =>
      String(song.ownerId) === String(deviceId) &&
      (song.status === "queued" || song.status === "playing")
    )
  }, [queue, deviceId])

  const myActiveSong = useMemo(() => mySongs[0] || null, [mySongs])

  // =========================
  // TURN LOGIC (FIXED)
  // =========================

  const turnsLeft = useMemo(() => {

    if (!myActiveSong) return -1

    const activeQueue = queue
      .filter(song =>
        song.status === "queued" ||
        song.status === "playing"
      )
      .sort((a, b) => a.createdAt - b.createdAt)

    return activeQueue.findIndex(
      song => song.id === myActiveSong.id
    )

  }, [queue, myActiveSong])

  const isMyTurn = turnsLeft === 0
  const isMySongPlaying =
    currentSong?.id === myActiveSong?.id

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
  // ALERT SYSTEM (FIXED LOCK)
  // =========================

  useEffect(() => {

    if (!myActiveSong) {
      alertOpen.current = false
      if (Swal.isVisible()) Swal.close()
      return
    }

    if (alertOpen.current) return
    alertOpen.current = true

    const alertKey =
      `${myActiveSong.id}-${turnsLeft}-${currentSong?.id}`

    // =====================
    // PLAYING
    // =====================

    if (isMySongPlaying) {

      Swal.fire({
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
      }).then(() => {
        alertOpen.current = false
      })

      return
    }

    // =====================
    // TURN READY
    // =====================

    if (isMyTurn) {

      Swal.fire({
        title: "Tu turno está listo 🎤",
        html: `
          <div style="text-align:center;font-size:16px;">
            <b style="font-size:20px;color:#22d3ee;">
              ${myActiveSong.title}
            </b>
            <br/><br/>
            <span style="color:#d4d4d8;">
              Prepárate, eres el siguiente
            </span>
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
      }).then(async res => {

        alertOpen.current = false

        if (res.isDenied && !isMySongPlaying) {
          setEditMode(true)
          setEditSongData(myActiveSong)
          setSearch("")
          setResults([])
        }

        if (res.dismiss === Swal.DismissReason.cancel) {

          const confirm = await Swal.fire({
            title: "¿Cancelar canción?",
            text: "Tu turno será eliminado",
            icon: "warning",
            background: "#000",
            color: "#06b6d4",
            showCancelButton: true,
            confirmButtonText: "Sí, cancelar",
            cancelButtonText: "Volver",
          })

          if (confirm.isConfirmed) {
            await cancelSong(myActiveSong.id)

            Swal.fire({
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
        }

      })

      return
    }

    // =====================
    // WAITING
    // =====================

    Swal.fire({
      title: "Tu canción está en cola",
      html: `
        <div style="text-align:center;font-size:16px;">
          <b style="font-size:20px;color:#22d3ee;">
            ${myActiveSong.title}
          </b>
          <br/><br/>
          <span style="color:#a1a1aa;">
            Te faltan <b style="color:white">${turnsLeft}</b> turnos
          </span>
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
    }).then(async res => {

      alertOpen.current = false

      if (res.isDenied && !isMySongPlaying) {
        setEditMode(true)
        setEditSongData(myActiveSong)
        setSearch("")
        setResults([])
      }

      if (res.dismiss === Swal.DismissReason.cancel) {

        const confirm = await Swal.fire({
          title: "¿Cancelar canción?",
          text: "Tu turno será eliminado",
          icon: "warning",
          background: "#000",
          color: "#06b6d4",
          showCancelButton: true,
          confirmButtonText: "Sí, cancelar",
          cancelButtonText: "Volver",
        })

        if (confirm.isConfirmed) {
          await cancelSong(myActiveSong.id)

          Swal.fire({
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
  // ADD SONG (FIXED)
  // =========================

  const handleAddSong = async (song) => {

    if (mySongs.length > 0) {

      Swal.fire({
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

    await addSong({
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId,
      ownerId: deviceId
    })

    setSearch("")
    setResults([])
  }

  // =========================
  // REPLACE SONG
  // =========================

  const handleReplaceSong = async (song) => {

    if (!editSongData) return

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
    <div className="mobile">

      <div className="mobile-header">
        <h1 className="mobile-title">MKaraoke</h1>
        <p className="mobile-subtitle">
          Busca tu canción en YouTube
        </p>
      </div>

      <div className="mobile-search">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={editMode ? "Buscar reemplazo..." : "Buscar canción..."}
          className="mobile-input"
        />
      </div>

      <div className="mobile-results">

        {loading && (
          <p style={{ color: "#71717a" }}>Buscando...</p>
        )}

        {results.map(song => (
          <div key={song.youtubeId} className="song-card">

            <div className="song-thumb">
              <img src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`} />
            </div>

            <div className="song-info">
              <p className="song-title">{song.title}</p>
              <p className="song-artist">{song.artist}</p>
            </div>

            <button
              className="song-btn"
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

      <div className="mobile-footer">
        Cola global: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage