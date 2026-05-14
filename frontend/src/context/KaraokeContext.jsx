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
  // APP STATE MACHINE
  // =========================
  const [appState, setAppState] = useState("BOOTING")

  // =========================
  // USER
  // =========================
  const [user, setUser] = useState(null)

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
  // QUEUE (RAW)
  // =========================
  const [queue, setQueue] = useState([])

  // =========================
  // SAFE QUEUE (🔥 CRASH PROOF)
  // =========================
  const safeQueue = useMemo(() => {
    return Array.isArray(queue) ? queue : []
  }, [queue])

  // =========================
  // CURRENT SONG SAFE
  // =========================
  const currentSong = useMemo(() => {
    return safeQueue.find(s => s?.status === "playing") || null
  }, [safeQueue])

  // =========================
  // LOAD USER (BOOT SAFE)
  // =========================
  useEffect(() => {

    let mounted = true

    const load = async () => {
      setAppState("BOOTING")

      try {
        const res = await getUserApi(deviceId)

        if (!mounted) return

        if (res?.id && res?.artist_name) {
          setUser(res)
          setAppState("READY")
        } else {
          setUser(null)
          setAppState("AUTH")
        }

      } catch {
        setUser(null)
        setAppState("AUTH")
      }
    }

    if (deviceId) load()

    return () => {
      mounted = false
    }
  }, [deviceId])

  // =========================
  // REGISTER USER
  // =========================
  const registerUser = async (artistName) => {

    const clean = artistName?.trim()
    if (!clean) return null

    const payload = {
      id: deviceId,
      artistName: clean
    }

    await createUserApi(payload)

    setUser(payload)
    setAppState("READY")

    return payload
  }

  // =========================
  // ACTIONS SAFE WRAPPERS
  // =========================
  const addSong = async (song) => {
    return addSongApi({
      ownerId: deviceId,
      title: song?.title || "",
      artist: song?.artist || "",
      youtubeId: song?.youtubeId || "",
    })
  }

  const editSong = async (id, data) =>
    editSongApi(id, data)

  const cancelSong = async (id) =>
    cancelSongApi(id)

  const playNextSong = async () =>
    nextSongApi()

  const playNow = async (id) =>
    playNowApi(id)

  const removeSongById = async (id) =>
    removeSongApi(id)

  // =========================
  // FLAGS
  // =========================
  const isBooting = appState === "BOOTING"
  const isAuth = appState === "AUTH"
  const isReady = appState === "READY"

  // =========================
  // PROVIDER
  // =========================
  return (
    <KaraokeContext.Provider value={{

      appState,
      isBooting,
      isAuth,
      isReady,

      user,
      registerUser,

      deviceId,

      queue: safeQueue,   // 🔥 IMPORTANT
      currentSong,

      setQueue,

      addSong,
      editSong,
      cancelSong,
      playNextSong,
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