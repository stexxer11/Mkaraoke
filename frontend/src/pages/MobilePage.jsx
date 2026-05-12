import {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react"

import debounce from "lodash.debounce"
import Swal from "sweetalert2"

import { useKaraoke } from "../context/KaraokeContext"
import { useYouTube } from "../context/YouTubeContext"

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
  // YOUTUBE CONTEXT (FIX PRINCIPAL)
  // =========================

  const {
    results,
    loading,
    searchSongs,
  } = useYouTube()

  // =========================
  // STATES
  // =========================

  const [search, setSearch] = useState("")
  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const alertOpen = useRef(null)

  // =========================
  // SEARCH (USANDO CONTEXT)
  // =========================

  const debouncedSearch = useMemo(() =>
    debounce((value) => {

      if (!value || value.trim().length < 3) {
        searchSongs("")
        return
      }

      searchSongs(value)

    }, 700)
  , [searchSongs])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // =========================
  // MY SONGS
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
      searchSongs("")
    }

  }, [isMySongPlaying, editMode])

  // =========================
  // ALERT SYSTEM (ESTABILIZADO)
  // =========================

  useEffect(() => {

    if (!myActiveSong) {
      alertOpen.current = null
      if (Swal.isVisible()) Swal.close()
      return
    }

    const alertKey = myActiveSong.id

    if (alertOpen.current === alertKey) return
    alertOpen.current = alertKey

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
        showConfirmButton: false,
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
          searchSongs("")
        }

        if (res.dismiss === Swal.DismissReason.cancel) {

          Swal.fire({
            title: "¿Cancelar canción?",
            icon: "warning",
            background: "#000",
            color: "#06b6d4",
            showCancelButton: true,
          }).then(async confirm => {

            if (confirm.isConfirmed) {
              await cancelSong(myActiveSong.id)
            }

          })
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
      showConfirmButton: false,
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
  // ADD SONG
  // =========================

  const handleAddSong = async (song) => {

    if (mySongs.length > 0) return

    await addSong({
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId,
    })

    setSearch("")
    searchSongs("")
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
    searchSongs("")
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
              <img
                src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              />
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