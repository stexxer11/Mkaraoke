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
  repeatSongApi,
  reorderQueueApi,
  restartSongApi,
} from "../services/karaokeApi"

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
  // STATE (SOURCE OF TRUTH)
  // =====================================================

  const [queue, setQueue] = useState([])
  const [playerVersion, setPlayerVersion] = useState(0)

  const socketRef = useRef(null)
  const reconnectRef = useRef(0)

  // =====================================================
  // DERIVED STATE (GLOBAL FIX)
  // =====================================================

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

  // =====================================================
  // SAFE WS SEND
  // =====================================================

  const safeSend = (data) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== 1) return
    ws.send(JSON.stringify(data))
  }

  // =====================================================
  // WEBSOCKET CONNECTION (FIXED SYNC)
  // =====================================================

  useEffect(() => {

    let ws
    let shouldReconnect = true

    const connect = () => {

      ws = new WebSocket(
        `${import.meta.env.VITE_WS_URL.replace("https", "wss")}/ws`
      )

      socketRef.current = ws

      ws.onopen = () => {
        console.log("WS CONNECTED")

        reconnectRef.current = 0

        // sync inicial
        safeSend({
          type: "GET_STATE",
          deviceId
        })
      }

      ws.onmessage = (event) => {
        try {

          const data = JSON.parse(event.data)

          // =================================================
          // QUEUE UPDATE (MAIN SOURCE)
          // =================================================

          if (data.type === "queue_update") {
            setQueue(data.queue || [])
          }

          // =================================================
          // VIDEO CONTROL (FORCE RELOAD TV)
          // =================================================

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

        console.log(`WS RECONNECT IN ${timeout}ms`)

        setTimeout(connect, timeout)
      }
    }

    connect()

    return () => {
      shouldReconnect = false
      ws?.close()
    }

  }, [deviceId])

  // =====================================================
  // ACTIONS
  // =====================================================

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

  const editSong = async (id, data) => {
    try {
      return await editSongApi(id, data)
    } catch {
      return { ok: false }
    }
  }

  const cancelSong = async (id) => {
    try {
      return await cancelSongApi(id)
    } catch {
      return { ok: false }
    }
  }

  const playNextSong = async () => {
    try {
      return await nextSongApi()
    } catch (err) {
      console.log(err)
    }
  }

  const playNow = async (id) => {
    try {
      return await playNowApi(id)
    } catch {
      return { ok: false }
    }
  }

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
      visibleQueue,
      activeQueue,
      currentSong,

      // PLAYER
      playerVersion,

      // USER
      deviceId,
      mySongs,
      hasActiveSong,

      // ACTIONS
      // ADMIN ACTIONS
      playNow,
      removeSongById,
      repeatSong,
      reorderQueue,
      restartSong,

      // PLAYER ACTIONS
      playNextSong,

      // ADMIN ACTIONS
      playNow,
      removeSongById,

      // INTERNAL
      safeSend

    }}>
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}

const repeatSong = async (song) => {
  try {
    return await repeatSongApi(song)
  } catch (err) {
    console.log(err)
    return { ok: false }
  }
}

const reorderQueue = async (newQueue) => {
  try {

    const ids = newQueue
      .filter(s => s.status === "queued")
      .map(s => s.id)

    return await reorderQueueApi(ids)

  } catch (err) {
    console.log(err)
    return { ok: false }
  }
}

const restartSong = async (id) => {
  try {
    return await restartSongApi(id)
  } catch (err) {
    console.log(err)
    return { ok: false }
  }
}

