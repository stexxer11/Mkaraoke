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
  // USER STATE
  // =========================
  const [user, setUser] = useState(null)

  // IMPORTANTE:
  // fake session compatible con MobilePage
  const [session, setSession] = useState(null)

  const [loadingUser, setLoadingUser] = useState(true)

  // =========================
  // DEVICE ID
  // =========================
  const [deviceId] = useState(() => {

    const saved =
      localStorage.getItem("mk_device_id")

    if (saved) return saved

    const id = crypto.randomUUID()

    localStorage.setItem(
      "mk_device_id",
      id
    )

    return id
  })

  // =========================
  // QUEUE STATE
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
  // LOAD USER
  // =========================
  useEffect(() => {

    let mounted = true

    const loadUser = async () => {

      console.log("LOADING USER...")

      setLoadingUser(true)

      try {

        const res =
          await getUserApi(deviceId)

        console.log(
          "GET USER RESPONSE:",
          res
        )

        if (!mounted) return

        // =========================
        // USER EXISTS
        // =========================
        if (res?.id) {

          console.log(
            "USER FOUND"
          )

          setUser(res)

          // fake session
          setSession({
            user: {
              id: res.id
            }
          })

        } else {

          // =========================
          // NEW USER
          // =========================
          console.log(
            "NEW DEVICE USER"
          )

          const tempUser = {
            id: deviceId,
            artist_name: null
          }

          setUser(tempUser)

          // fake session
          setSession({
            user: {
              id: deviceId
            }
          })
        }

      } catch (err) {

        console.log(
          "LOAD USER ERROR:",
          err
        )

        // fallback
        const tempUser = {
          id: deviceId,
          artist_name: null
        }

        setUser(tempUser)

        setSession({
          user: {
            id: deviceId
          }
        })

      } finally {

        if (mounted) {

          console.log(
            "USER LOAD FINISHED"
          )

          setLoadingUser(false)
        }
      }
    }

    if (deviceId) {
      loadUser()
    }

    return () => {
      mounted = false
    }

  }, [deviceId])

  // =========================
  // REGISTER USER
  // =========================
  const registerUser = async (artistName) => {

    try {

      const clean =
        artistName?.trim()

      if (!clean) {
        throw new Error(
          "Nombre inválido"
        )
      }

      const payload = {
        id: deviceId,
        artist_name: clean
      }

      console.log(
        "CREATING USER:",
        payload
      )

      const createdUser =
        await createUserApi(payload)

      console.log(
        "USER CREATED:",
        createdUser
      )

      const finalUser =
        createdUser || payload

      setUser(finalUser)

      // asegurar session
      setSession({
        user: {
          id: finalUser.id
        }
      })

      return finalUser

    } catch (err) {

      console.log(
        "CREATE USER ERROR:",
        err
      )

      throw err
    }
  }

  // =========================
  // DERIVED STATE
  // =========================
  const currentSong = useMemo(
    () =>
      queue.find(
        s => s.status === "playing"
      ) || null,
    [queue]
  )

  const activeQueue = useMemo(
    () =>
      queue.filter(
        s =>
          s.status === "queued" ||
          s.status === "playing"
      ),
    [queue]
  )

  const mySongs = useMemo(
    () =>
      activeQueue.filter(
        s =>
          String(s.owner_id) ===
          String(deviceId)
      ),
    [activeQueue, deviceId]
  )

  const visibleQueue = useMemo(
    () =>
      queue.filter(
        s =>
          s.status !== "done" &&
          s.status !== "cancelled"
      ),
    [queue]
  )

  // =========================
  // WS SAFE SEND
  // =========================
  const safeSend = (data) => {

    const ws = socketRef.current

    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN
    ) {
      return
    }

    ws.send(JSON.stringify(data))
  }

  // =========================
  // WEBSOCKET
  // =========================
  useEffect(() => {

    let shouldReconnect = true

    const connect = () => {

      const url =
        `${import.meta.env.VITE_WS_URL?.replace(
          "https",
          "wss"
        )}/ws`

      if (!url) return

      console.log(
        "CONNECTING WS:",
        url
      )

      const ws = new WebSocket(url)

      socketRef.current = ws

      ws.onopen = () => {

        console.log("WS CONNECTED")

        reconnectRef.current = 0

        safeSend({
          type: "GET_STATE",
          deviceId
        })
      }

      ws.onmessage = (event) => {

        try {

          const data =
            JSON.parse(event.data)

          console.log(
            "WS MESSAGE:",
            data
          )

          if (
            data.type === "queue_update"
          ) {
            setQueue(data.queue || [])
          }

          if (
            data.type === "LOAD_VIDEO" ||
            data.type === "STOP_VIDEO"
          ) {
            setPlayerVersion(v => v + 1)
          }

        } catch (err) {

          console.log(
            "WS PARSE ERROR",
            err
          )
        }
      }

      ws.onerror = () =>
        console.log("WS ERROR")

      ws.onclose = () => {

        console.log("WS CLOSED")

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
        clearTimeout(
          reconnectTimeoutRef.current
        )
      }

      socketRef.current?.close()
    }

  }, [deviceId])

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

      return {
        ok: false,
        error: err.message
      }
    }
  }

  const editSong = async (id, data) =>
    editSongApi(id, data)
      .catch(() => ({ ok: false }))

  const cancelSong = async (id) =>
    cancelSongApi(id)
      .catch(() => ({ ok: false }))

  const playNextSong = async () =>
    nextSongApi()
      .catch(console.log)

  const playNow = async (id) =>
    playNowApi(id)
      .catch(() => ({ ok: false }))

  const removeSongById = async (id) =>
    removeSongApi(id)
      .catch(console.log)

  // =========================
  // PROVIDER
  // =========================
  return (
    <KaraokeContext.Provider
      value={{

        queue,
        visibleQueue,
        activeQueue,
        currentSong,

        playerVersion,

        mySongs,

        user,
        session,
        loadingUser,
        registerUser,

        addSong,
        editSong,
        cancelSong,
        playNextSong,
        playNow,
        removeSongById,

        safeSend,
        deviceId,
      }}
    >
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}