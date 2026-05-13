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
  registerUserApi,
} from "../services/karaokeApi"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  // =========================
  // DEVICE ID
  // =========================
  const [deviceId] = useState(() => {
    const saved = localStorage.getItem("mk_device_id")
    if (saved) return saved

    const id = crypto.randomUUID()
    localStorage.setItem("mk_device_id", id)
    return id
  })

  // =========================
  // USERNAME
  // =========================
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("mk_username") || ""
  })

  // =========================
  // STATE
  // =========================
  const [queue, setQueue] = useState([])
  const [playerVersion, setPlayerVersion] = useState(0)

  const socketRef = useRef(null)
  const reconnectRef = useRef(0)

  // =========================
  // DERIVED STATE
  // =========================
  const currentSong = useMemo(() => {
    return queue.find(s => s.status === "playing") || null
  }, [queue])

  const activeQueue = useMemo(() => {
    return queue.filter(
      s => s.status === "queued" || s.status === "playing"
    )
  }, [queue])

  const mySongs = useMemo(() => {
    return activeQueue.filter(
      s => String(s.ownerId) === String(deviceId)
    )
  }, [activeQueue, deviceId])

  const hasActiveSong = mySongs.length > 0

  const visibleQueue = useMemo(() => {
    return queue.filter(
      s => s.status !== "done" && s.status !== "cancelled"
    )
  }, [queue])

  // =========================
  // WS SAFE SEND
  // =========================
  const safeSend = (data) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== 1) return
    ws.send(JSON.stringify(data))
  }

  // =========================
  // WEBSOCKET
  // =========================
  useEffect(() => {

    let ws
    let shouldReconnect = true

    const connect = () => {

      const base = import.meta.env.VITE_WS_URL

      if (!base) {
        console.error("VITE_WS_URL no definido")
        return
      }

      const url = base.startsWith("ws")
        ? base
        : base.replace("https", "wss")

      ws = new WebSocket(`${url}/ws`)
      socketRef.current = ws

      ws.onopen = () => {
        console.log("WS CONNECTED")
        reconnectRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === "queue_update") {
            setQueue(data.queue || [])
          }

          if (
            data.type === "LOAD_VIDEO" ||
            data.type === "STOP_VIDEO"
          ) {
            setPlayerVersion(v => v + 1)
          }

        } catch (err) {
          console.log("WS PARSE ERROR", err)
        }
      }

      ws.onerror = (err) => {
        console.log("WS ERROR", err)
      }

      ws.onclose = () => {

        if (!shouldReconnect) return

        const timeout = Math.min(
          1000 * 2 ** reconnectRef.current,
          10000
        )

        reconnectRef.current += 1
        setTimeout(connect, timeout)
      }
    }

    connect()

    return () => {
      shouldReconnect = false
      ws?.close()
    }

  }, [deviceId])

  // =========================
  // REGISTER USER
  // =========================
  useEffect(() => {

    const register = async () => {
      if (!deviceId || !username) return

      try {
        await registerUserApi(deviceId, username)
        localStorage.setItem("mk_username", username)
      } catch (err) {
        console.log("USER REGISTER ERROR", err)
      }
    }

    register()

  }, [deviceId, username])

  // =========================
  // ACTIONS
  // =========================
  const addSong = async (songData) => {
    return addSongApi({
      ownerId: deviceId,
      username,
      title: songData.title,
      artist: songData.artist,
      youtubeId: songData.youtubeId,
    })
  }

  const editSong = async (id, data) => editSongApi(id, data)
  const cancelSong = async (id) => cancelSongApi(id)
  const playNextSong = async () => nextSongApi()
  const playNow = async (id) => playNowApi(id)

  // =========================
  // PROVIDER
  // =========================
  return (
    <KaraokeContext.Provider value={{

      queue,
      visibleQueue,
      activeQueue,
      currentSong,

      playerVersion,

      deviceId,
      username,
      setUsername,
      mySongs,
      hasActiveSong,

      addSong,
      editSong,
      cancelSong,

      playNextSong,
      playNow,

      safeSend

    }}>
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}