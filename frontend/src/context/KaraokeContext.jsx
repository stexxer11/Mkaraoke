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
  // DEVICE ID (FIX STABLE)
  // =========================
  const [deviceId] = useState(() => {
    const saved = localStorage.getItem("mk_device_id")
    if (saved) return saved

    const id = crypto.randomUUID()
    localStorage.setItem("mk_device_id", id)
    return id
  })

  // =========================
  // USER STATE
  // =========================
  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const userLoadedRef = useRef(false)

  // =========================
  // QUEUE STATE
  // =========================
  const [queue, setQueue] = useState([])
  const [playerVersion, setPlayerVersion] = useState(0)

  // =========================
  // SOCKET
  // =========================
  const socketRef = useRef(null)
  const reconnectRef = useRef(0)
  const reconnectTimeoutRef = useRef(null)

  // =========================
  // LOAD USER (FIX ANONIMO BUG)
  // =========================
  useEffect(() => {
    let mounted = true

    const loadUser = async () => {
      if (userLoadedRef.current) return
      userLoadedRef.current = true

      try {
        const res = await getUserApi(deviceId)

        if (!mounted) return

        if (res?.id && res?.artistName) {
          setUser(res)
        } else {
          setUser(null)
        }

      } catch (err) {

        const status = err?.response?.status

        // SOLO 404 = usuario no existe
        if (status === 404) {
          setUser(null)
        } else {
          console.log("GET USER ERROR:", err)
          setUser(null)
        }

      } finally {
        if (mounted) setLoadingUser(false)
      }
    }

    loadUser()

    return () => {
      mounted = false
    }
  }, [deviceId])

  // =========================
  // REGISTER USER (FIX DUPLICADOS "ANONIMO")
  // =========================
  const registerUser = async (artistName) => {
    try {
      const cleanName = artistName?.trim()

      if (!cleanName) throw new Error("Nombre inválido")

      const res = await createUserApi({
        id: deviceId,
        artistName: cleanName
      })

      const newUser = {
        id: deviceId,
        artistName: cleanName
      }

      setUser(newUser)
      return newUser

    } catch (err) {
      console.log("CREATE USER ERROR:", err)
      return null
    }
  }

  // =========================
  // DERIVED STATE (FIX STABLE + SAFE)
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
      s => String(s.ownerId) === String(deviceId)
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
  // WEBSOCKET (FIX RECONNECT + NO LOOP BUG)
  // =========================
  useEffect(() => {

    let shouldReconnect = true

    const connect = () => {

      const url = `${import.meta.env.VITE_WS_URL.replace("https", "wss")}/ws`

      const ws = new WebSocket(url)
      socketRef.current = ws

      ws.onopen = () => {
        reconnectRef.current = 0

        safeSend({
          type: "GET_STATE",
          deviceId
        })
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

      ws.onerror = () => {
        console.log("WS ERROR")
      }

      ws.onclose = () => {

        if (!shouldReconnect) return

        const timeout = Math.min(
          1000 * 2 ** reconnectRef.current,
          10000
        )

        reconnectRef.current += 1

        reconnectTimeoutRef.current = setTimeout(connect, timeout)
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

  }, [deviceId])

  // =========================
  // ACTIONS (SAFE RETURN FORMAT FIX)
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
      return { ok: false, error: err?.message }
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

      queue,
      visibleQueue,
      activeQueue,
      currentSong,

      playerVersion,

      deviceId,
      mySongs,

      user,
      loadingUser,
      registerUser,

      addSong,
      editSong,
      cancelSong,
      playNextSong,
      playNow,
      removeSongById,

      safeSend

    }}>
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}