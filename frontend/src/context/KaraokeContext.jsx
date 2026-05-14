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
  // STATE MACHINE (🔥 CORE)
  // =========================
  const [appState, setAppState] = useState("BOOTING")

  // BOOTING → AUTH → READY
  // =========================

  // =========================
  // SUPABASE USER
  // =========================
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)

  // =========================
  // QUEUE (WS SOURCE OF TRUTH)
  // =========================
  const [queue, setQueue] = useState([])

  const safeQueue = useMemo(
    () => Array.isArray(queue) ? queue : [],
    [queue]
  )

  const currentSong = useMemo(() => {
    return safeQueue.find(s => s?.status === "playing") || null
  }, [safeQueue])

  // =========================
  // BOOTSTRAP (SUPABASE SESSION)
  // =========================
  useEffect(() => {

    const init = async () => {
      setAppState("BOOTING")

      try {
        // 🔥 SUPABASE SESSION (IMPORTANTE)
        const { data: { session } } = await fetch(
          "/api/session"
        ).then(r => r.json())

        setSession(session || null)

        if (!session?.user) {
          setAppState("AUTH")
          return
        }

        const res = await getUserApi(session.user.id)

        if (res?.id && res?.artist_name) {
          setUser(res)
          setAppState("READY")
        } else {
          setUser(null)
          setAppState("AUTH")
        }

      } catch (err) {
        console.error("BOOT ERROR", err)
        setAppState("AUTH")
      }
    }

    init()
  }, [])

  // =========================
  // REGISTER USER (SUPABASE ID)
  // =========================
  const registerUser = async (artistName) => {

    const clean = artistName?.trim()
    if (!clean || !session?.user?.id) return null

    const payload = {
      id: session.user.id,
      artistName: clean
    }

    await createUserApi(payload)

    const userRes = await getUserApi(session.user.id)

    setUser(userRes)
    setAppState("READY")

    return userRes
  }

  // =========================
  // QUEUE ACTIONS (SAFE)
  // =========================
  const addSong = async (song) => {
    return addSongApi({
      ownerId: session?.user?.id,
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
  // FLAGS CLEAN
  // =========================
  const isBooting = appState === "BOOTING"
  const isAuth = appState === "AUTH"
  const isReady = appState === "READY"

  // =========================
  // CONTEXT VALUE
  // =========================
  return (
    <KaraokeContext.Provider value={{

      // STATE MACHINE
      appState,
      isBooting,
      isAuth,
      isReady,

      // AUTH
      session,
      user,
      registerUser,

      // QUEUE
      queue: safeQueue,
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