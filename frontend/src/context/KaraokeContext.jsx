import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

import { supabase } from "../services/supabaseClient"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  // =========================
  // STATE MACHINE
  // =========================
  const [appState, setAppState] = useState("BOOTING")

  // =========================
  // SUPABASE SESSION
  // =========================
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)

  // =========================
  // QUEUE
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
  // BOOT SUPABASE SESSION (FIX REAL)
  // =========================
  useEffect(() => {

    const init = async () => {
      setAppState("BOOTING")

      try {
        const {
          data: { session }
        } = await supabase.auth.getSession()

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

    // 🔥 live auth listener
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)

        if (!session?.user) {
          setUser(null)
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
      }
    )

    return () => listener.subscription.unsubscribe()

  }, [])

  // =========================
  // REGISTER USER
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
  // ACTIONS
  // =========================
  const addSong = async (song) => {
    return addSongApi({
      ownerId: session?.user?.id,
      title: song?.title || "",
      artist: song?.artist || "",
      youtubeId: song?.youtubeId || "",
    })
  }

  const editSong = async (id, data) => editSongApi(id, data)
  const cancelSong = async (id) => cancelSongApi(id)
  const playNextSong = async () => nextSongApi()
  const playNow = async (id) => playNowApi(id)
  const removeSongById = async (id) => removeSongApi(id)

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

      session,
      user,
      registerUser,

      queue: safeQueue,
      currentSong,

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