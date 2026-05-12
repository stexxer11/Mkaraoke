
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
  // SEARCH YOUTUBE
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
          console.log("SEARCH ERROR:", err)
          setResults([])
        }

        setLoading(false)

      }, 600),
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
  // MIS CANCIONES
  // =========================

  const mySongs = useMemo(() => {
    return queue.filter(song =>
      String(song.ownerId) === String(deviceId) &&
      (song.status === "queued" || song.status === "playing")
    )
  }, [queue, deviceId])

  const myActiveSong = useMemo(() => mySongs[0] || null, [mySongs])

  // =========================
  // TURNOS
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
  // ALERT SYSTEM
  // =========================

  useEffect(() => {

    if (!myActiveSong) {
      alertOpen.current = false
      if (Swal.isVisible()) Swal.close()
      return
    }

    if (alertOpen.current) return
    alertOpen.current = true

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
      }).then(() => {
        alertOpen.current = false
      })

      return
    }

    // =====================
    // TU TURNO
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
        denyButtonText: "Editar",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
      }).then(async res => {

        alertOpen.current = false

        if (res.isDenied) {
          setEditMode(true)
          setEditSongData(myActiveSong)
          setSearch("")
          setResults([])
        }

        if (res.dismiss === Swal.DismissReason.cancel) {

          const confirm = await Swal.fire({
            title: "¿Cancelar canción?",
            icon: "warning",
            background: "#000",
            color: "#06b6d4",
            showCancelButton: true,
            confirmButtonText: "Sí",
          })

          if (confirm.isConfirmed) {
            await cancelSong(myActiveSong.id)
          }
        }

      })

      return
    }

    // =====================
    // EN COLA
    // =====================

    Swal.fire({
      title: "En cola",
      html: `
        <div style="text-align:center;">
          <b style="color:#22d3ee;">
            ${myActiveSong.title}
          </b>
          <br/><br/>
          Te faltan <b style="color:white">${turnsLeft}</b> turnos
        </div>
      `,
      background: "#000",
      color: "#06b6d4",
      showConfirmButton: false,
      showDenyButton: true,
      denyButtonText: "Editar",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
    }).then(async res => {

      alertOpen.current = false

      if (res.isDenied) {
        setEditMode(true)
        setEditSongData(myActiveSong)
        setSearch("")
        setResults([])
      }

      if (res.dismiss === Swal.DismissReason.cancel) {

        const confirm = await Swal.fire({
          title: "¿Cancelar canción?",
          icon: "warning",
          background: "#000",
          color: "#06b6d4",
          showCancelButton: true,
          confirmButtonText: "Sí",
        })

        if (confirm.isConfirmed) {
          await cancelSong(myActiveSong.id)
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
  // ADD SONG
  // =========================

  const handleAddSong = async (song) => {

    if (mySongs.length > 0) {
      Swal.fire({
        icon: "warning",
        title: "Ya tienes canción activa",
        toast: true,
        timer: 2000,
        showConfirmButton: false,
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
  // UI
  // =========================

  return (
    <div className="mobile">

      <div className="mobile-header">
        <h1>MKaraoke</h1>
        <p>Busca tu canción</p>
      </div>

      <input
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={editMode ? "Editar canción..." : "Buscar..."}
      />

      <div className="mobile-results">

        {loading && <p>Buscando...</p>}

        {results.map(song => (
          <div key={song.youtubeId}>
            <img src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`} />

            <div>
              <b>{song.title}</b>
              <p>{song.artist}</p>
            </div>

            <button
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

      <div>
        Cola: {queue.length}
      </div>

    </div>
  )
}

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

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const alertOpen = useRef(false)

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
          console.log("SEARCH ERROR:", err)
          setResults([])
        }

        setLoading(false)

      }, 600),
    []
  )

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  const mySongs = useMemo(() => {
    return queue.filter(song =>
      String(song.ownerId) === String(deviceId) &&
      (song.status === "queued" || song.status === "playing")
    )
  }, [queue, deviceId])

  const myActiveSong = useMemo(() => mySongs[0] || null, [mySongs])

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
  const isMySongPlaying = currentSong?.id === myActiveSong?.id

  useEffect(() => {

    if (isMySongPlaying && editMode) {
      setEditMode(false)
      setEditSongData(null)
      setSearch("")
      setResults([])
    }

  }, [isMySongPlaying, editMode])

  useEffect(() => {

    if (!myActiveSong) {
      alertOpen.current = false
      if (Swal.isVisible()) Swal.close()
      return
    }

    if (alertOpen.current) return
    alertOpen.current = true

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
      }).then(() => alertOpen.current = false)

      return
    }

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
        denyButtonText: "Editar",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
      }).then(async res => {

        alertOpen.current = false

        if (res.isDenied) {
          setEditMode(true)
          setEditSongData(myActiveSong)
          setSearch("")
          setResults([])
        }

        if (res.dismiss === Swal.DismissReason.cancel) {

          const confirm = await Swal.fire({
            title: "¿Cancelar canción?",
            icon: "warning",
            background: "#000",
            color: "#06b6d4",
            showCancelButton: true,
            confirmButtonText: "Sí",
          })

          if (confirm.isConfirmed) {
            await cancelSong(myActiveSong.id)
          }
        }

      })

      return
    }

  }, [
    queue,
    currentSong,
    myActiveSong,
    turnsLeft,
    isMyTurn,
    isMySongPlaying,
    deviceId
  ])

  const handleAddSong = async (song) => {

    if (mySongs.length > 0) {
      Swal.fire({
        icon: "warning",
        title: "Ya tienes canción activa",
        toast: true,
        timer: 2000,
        showConfirmButton: false,
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

  return (
    <div className="mobile">

      <div className="mobile-header">
        <div className="mobile-title">MKaraoke</div>
        <div className="mobile-subtitle">Busca tu canción</div>
      </div>

      <div className="mobile-search">
        <input
          className="mobile-input"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={editMode ? "Editar canción..." : "Buscar..."}
        />
      </div>

      <div className="mobile-results">

        {loading && <p style={{ color: "#71717a" }}>Buscando...</p>}

        {results.map(song => (
          <div className="song-card" key={song.youtubeId}>

            <div className="song-thumb">
              <img src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`} />
            </div>

            <div className="song-info">
              <div className="song-title">{song.title}</div>
              <div className="song-artist">{song.artist}</div>
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
        Cola: {queue.length}
      </div>

    </div>
  )
}

export default MobilePage