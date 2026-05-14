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

  // =====================================================
  // BOOTSTRAP STATE
  // =====================================================
  const [appState, setAppState] = useState("booting")
  // booting | auth | ready | error

  const [user, setUser] = useState(null)
  const [queue, setQueue] = useState([])
  const [playerVersion, setPlayerVersion] = useState(0)

  const socketRef = useRef(null)

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
  // LOAD USER (BOOTSTRAP STEP 1)
  // =====================================================
  useEffect(() => {

    const loadUser = async () => {
      try {
        setAppState("booting")

        const res = await getUserApi(deviceId)

        if (res?.id && res?.artist_name) {
          setUser(res)
          setAppState("ready")
        } else {
          setUser(res?.id ? res : null)
          setAppState("auth")
        }

      } catch (err) {
        console.log(err)
        setAppState("error")
      }
    }

    if (deviceId) loadUser()

  }, [deviceId])

  // =====================================================
  // REGISTER USER
  // =====================================================
  const registerUser = async (artistName) => {

    const clean = artistName?.trim()
    if (!clean) return null

    try {

      const payload = {
        id: deviceId,
        artistName: clean
      }

      await createUserApi(payload)

      setUser(payload)
      setAppState("ready")

      return payload

    } catch (err) {
      console.log("CREATE USER ERROR:", err)
      return null
    }
  }

  // =====================================================
  // DERIVED STATE
  // =====================================================
  const currentSong = useMemo(
    () => queue?.find(s => s.status === "playing") || null,
    [queue]
  )

  const activeQueue = useMemo(
    () => (queue || []).filter(
      s => s.status === "queued" || s.status === "playing"
    ),
    [queue]
  )

  const mySongs = useMemo(() => {
    if (!Array.isArray(queue)) return []
    if (!user?.id) return []

    return activeQueue.filter(
      s => String(s.owner_id) === String(user.id)
    )
  }, [activeQueue, user, queue])

  // =====================================================
  // WEBSOCKET (solo ready)
  // =====================================================
  useEffect(() => {

    if (appState !== "ready") return

    const ws = new WebSocket(
      import.meta.env.VITE_WS_URL?.replace("https", "wss") + "/ws"
    )

    socketRef.current = ws

    ws.onopen = () => {
      console.log("WS connected")
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === "queue_update") {
          setQueue(data.queue || [])
        }

        if (data.type === "LOAD_VIDEO" || data.type === "STOP_VIDEO") {
          setPlayerVersion(v => v + 1)
        }

      } catch (e) {
        console.log("WS parse error", e)
      }
    }

    ws.onerror = () => console.log("WS error")

    ws.onclose = () => console.log("WS closed")

    return () => ws.close()

  }, [appState])

  // =====================================================
  // ACTIONS
  // =====================================================
  const addSong = async (songData) => {
    return addSongApi({
      ownerId: deviceId,
      title: songData.title,
      artist: songData.artist,
      youtubeId: songData.youtubeId,
    })
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

  // =====================================================
  // PROVIDER
  // =====================================================
  return (
    <KaraokeContext.Provider value={{

      // STATE
      appState,
      isBooting: appState === "booting",
      isAuth: appState === "auth",
      isReady: appState === "ready",
      isError: appState === "error",

      // DATA
      user,
      queue,
      currentSong,
      mySongs,

      // WS VERSION
      playerVersion,

      // ACTIONS
      registerUser,
      addSong,
      editSong,
      cancelSong,
      playNextSong,
      playNow,
      removeSongById,

      deviceId,

    }}>
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}