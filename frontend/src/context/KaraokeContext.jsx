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
  getUserApi,
  createUserApi,
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
  // PHASE (CLAVE REAL DEL FIX)
  // =========================
  const [phase, setPhase] = useState("booting")
  // booting | onboarding | ready

  // =========================
  // USER
  // =========================
  const [user, setUser] = useState(null)

  // =========================
  // QUEUE
  // =========================
  const [queue, setQueue] = useState([])
  const [playerVersion, setPlayerVersion] = useState(0)

  // =========================
  // WS
  // =========================
  const socketRef = useRef(null)
  const reconnectRef = useRef(0)
  const reconnectTimeoutRef = useRef(null)

  // =========================
  // BOOTSTRAP USER (SOLO 1 VEZ)
  // =========================
  useEffect(() => {
    if (!deviceId) return

    const init = async () => {
      setPhase("booting")

      try {
        const res = await getUserApi(deviceId)

        if (res?.id && res?.artist_name) {
          setUser(res)
          setPhase("ready")
        } else {
          setUser(res) // puede venir null artist_name
          setPhase("onboarding")
        }

      } catch (err) {
        console.log("USER LOAD ERROR:", err)
        setUser(null)
        setPhase("onboarding")
      }
    }

    init()
  }, [deviceId])

  // =========================
  // REGISTER USER
  // =========================
  const registerUser = async (artistName) => {
    try {
      const clean = artistName?.trim()
      if (!clean) throw new Error("Nombre inválido")

      const payload = {
        id: deviceId,
        artistName: clean,
      }

      await createUserApi(payload)

      setUser(payload)
      setPhase("ready")

      return payload
    } catch (err) {
      console.log("CREATE USER ERROR:", err)
      return null
    }
  }

  // =========================
  // DERIVADOS
  // =========================
  const currentSong = useMemo(
    () => queue.find(s => s.status === "playing") || null,
    [queue]
  )

  const activeQueue = useMemo(
    () => queue.filter(
      s => s.status === "queued" || s.status === "playing"
    ),
    [queue]
  )

  const mySongs = useMemo(
    () => activeQueue.filter(
      s => String(s.owner_id) === String(deviceId)
    ),
    [activeQueue, deviceId]
  )

  const visibleQueue = useMemo(
    () => queue.filter(
      s => s.status !== "done" && s.status !== "cancelled"
    ),
    [queue]
  )

  // =========================
  // SAFE WS SEND
  // =========================
  const safeSend = (data) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(data))
  }

  // =========================
  // WEBSOCKET
  // =========================
  useEffect(() => {
    if (phase === "booting") return

    let shouldReconnect = true

    const connect = () => {
      const base = import.meta.env.VITE_WS_URL

      if (!base) return

      const url = base
        .replace("https://", "wss://")
        .replace("http://", "ws://")

      const ws = new WebSocket(`${url}/ws`)
      socketRef.current = ws

      ws.onopen = () => {
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

      ws.onerror = () => console.log("WS ERROR")

      ws.onclose = () => {
        if (!shouldReconnect) return

        const timeout = Math.min(
          1000 * 2 ** reconnectRef.current,
          10000
        )

        reconnectRef.current += 1

        reconnectTimeoutRef.current =
          setTimeout(connect, timeout)
      }
    }

    connect()

    return () => {
      shouldReconnect = false
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      socketRef.current?.close()
    }

  }, [phase])

  // =========================
  // ACTIONS
  // =========================
  const addSong = async (songData) => {
    try {
      return await addSongApi({
        ownerId: deviceId,
        title: songData.title,
        artist: songData.artist,
        youtubeId: songData.youtubeId,
      })
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  const editSong = async (id, data) =>
    editSongApi(id, data).catch(() => ({ ok: false }))

  const cancelSong = async (id) =>
    cancelSongApi(id).catch(() => ({ ok: false }))

  const playNextSong = async () =>
    nextSongApi().catch(console.log)

  const playNow = async (id) =>
    playNowApi(id).catch(() => ({ ok: false }))

  const removeSongById = async (id) =>
    removeSongApi(id).catch(console.log)

  // =========================
  // PROVIDER
  // =========================
  return (
    <KaraokeContext.Provider value={{

      // STATE
      phase,
      user,
      loadingUser: phase === "booting",

      queue,
      visibleQueue,
      activeQueue,
      currentSong,
      playerVersion,
      mySongs,

      // IDENTITY
      deviceId,

      // ACTIONS
      registerUser,
      addSong,
      editSong,
      cancelSong,
      playNextSong,
      playNow,
      removeSongById,

      safeSend,
    }}>
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}