import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  addSongApi,
  editSongApi,
  cancelSongApi,
  nextSongApi,
  playNowApi,
  removeSongApi,
} from "../services/youtubeApi"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  // =====================================================
  // DEVICE ID
  // =====================================================

  const [deviceId] = useState(() => {

    const saved = localStorage.getItem("mk_device_id")

    if (saved) return saved

    const id = crypto.randomUUID()

    localStorage.setItem("mk_device_id", id)

    return id
  })

  // =====================================================
  // STATE (SOURCE OF TRUTH = BACKEND)
  // =====================================================

  const [queue, setQueue] = useState([])
  const [currentSong, setCurrentSong] = useState(null)

  const [playerVersion, setPlayerVersion] = useState(0)

  const socketRef = useRef(null)

  // =====================================================
  // WEBSOCKET
  // =====================================================

  useEffect(() => {

    const ws = new WebSocket(
      `${import.meta.env.VITE_WS_URL.replace("https", "wss")}/ws`
    )

    socketRef.current = ws

    ws.onopen = () => {
      console.log("WS CONNECTED", deviceId)
    }

    ws.onmessage = (event) => {

      try {

        const data = JSON.parse(event.data)

        // =================================================
        // QUEUE UPDATE
        // =================================================

        if (data.type === "queue_update") {
          setQueue(data.queue || [])
        }

        // =================================================
        // LOAD VIDEO (SOURCE OF TRUTH)
        // =================================================

        if (data.type === "LOAD_VIDEO") {

          setCurrentSong(data.song)

          setPlayerVersion(prev => prev + 1)
        }

        // =================================================
        // STOP VIDEO
        // =================================================

        if (data.type === "STOP_VIDEO") {

          setCurrentSong(null)

          setPlayerVersion(prev => prev + 1)
        }

      } catch (err) {
        console.log("WS ERROR PARSE", err)
      }
    }

    ws.onerror = (err) => {
      console.log("WS ERROR", err)
    }

    ws.onclose = () => {
      console.log("WS CLOSED")
    }

    return () => ws.close()

  }, [deviceId])

  // =====================================================
  // ACTIVE QUEUE
  // =====================================================

  const activeQueue = useMemo(() => {
    return queue.filter(
      song =>
        song.status === "queued" ||
        song.status === "playing"
    )
  }, [queue])

  // =====================================================
  // MY SONGS (MULTIUSER SAFE)
  // =====================================================

  const mySongs = useMemo(() => {

    return activeQueue.filter(song =>
      String(song.ownerId) === String(deviceId)
    )

  }, [activeQueue, deviceId])

  const hasActiveSong = mySongs.length > 0

  // =====================================================
  // ADD SONG
  // =====================================================

  const addSong = async (songData) => {

    try {

      const res = await addSongApi({
        ownerId: deviceId,
        title: songData.title,
        artist: songData.artist,
        youtubeId: songData.youtubeId,
      })

      return res

    } catch (err) {

      console.log(err)

      return {
        ok: false,
        error: "ADD_SONG_ERROR"
      }
    }
  }

  // =====================================================
  // EDIT SONG
  // =====================================================

  const editSong = async (id, data) => {

    try {
      return await editSongApi(id, data)
    } catch (err) {
      return { ok: false }
    }
  }

  // =====================================================
  // CANCEL SONG
  // =====================================================

  const cancelSong = async (id) => {

    try {
      return await cancelSongApi(id)
    } catch (err) {
      return { ok: false }
    }
  }

  // =====================================================
  // NEXT SONG
  // =====================================================

  const playNextSong = async () => {

    try {
      return await nextSongApi()
    } catch (err) {
      console.log(err)
    }
  }

  // =====================================================
  // PLAY NOW
  // =====================================================

  const playNow = async (id) => {

    try {
      return await playNowApi(id)
    } catch (err) {
      return { ok: false }
    }
  }

  // =====================================================
  // REMOVE SONG
  // =====================================================

  const removeSongById = async (id) => {

    try {
      return await removeSongApi(id)
    } catch (err) {
      console.log(err)
    }
  }

  // =====================================================
  // PROVIDER
  // =====================================================

  return (
    <KaraokeContext.Provider value={{

      // STATE
      queue,
      activeQueue,
      currentSong,

      // PLAYER
      playerVersion,

      // USER
      deviceId,
      mySongs,
      hasActiveSong,

      // ACTIONS
      addSong,
      editSong,
      cancelSong,

      // PLAYER ACTIONS
      playNextSong,

      // ADMIN
      playNow,
      removeSongById,

    }}>
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}