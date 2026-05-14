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
  // STATE MACHINE
  // =========================
  const [appState, setAppState] = useState("BOOTING")
  // BOOTING → AUTH → READY

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
  // QUEUE
  // =========================
  const [queue, setQueue] = useState([])

  // =========================
  // CURRENT SONG
  // =========================
  const currentSong = useMemo(
    () => queue.find(s => s.status === "playing") || null,
    [queue]
  )

  // =========================
  // WS
  // =========================
  const socketRef = useRef(null)

  // =========================
  // LOAD USER (BOOT FLOW)
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

      } catch (e) {
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
  // ACTIONS
  // =========================
  const addSong = async (song) => {
    return addSongApi({
      ownerId: deviceId,
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId,
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
  // DERIVED FLAGS
  // =========================
  const isBooting = appState === "BOOTING"
  const isAuth = appState === "AUTH"
  const isReady = appState === "READY"

  // =========================
  // PROVIDER
  // =========================
  return (
    <KaraokeContext.Provider value={{

      // STATE MACHINE
      appState,
      isBooting,
      isAuth,
      isReady,

      // USER
      user,
      registerUser,

      // DEVICE
      deviceId,

      // QUEUE
      queue,
      setQueue,
      currentSong,

      // ACTIONS
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