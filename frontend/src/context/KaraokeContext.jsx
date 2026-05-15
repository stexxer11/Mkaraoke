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

import { supabase } from "../services/supabase"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  // =========================
  // STATE MACHINE
  // =========================
  const [appState, setAppState] = useState("BOOTING")
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

  const currentSong = useMemo(
    () => safeQueue.find(s => s?.status === "playing") || null,
    [safeQueue]
  )

  // =========================
  // INIT AUTH
  // =========================
  useEffect(() => {

    const init = async () => {
      setAppState("BOOTING")

      const { data } = await supabase.auth.getSession()
      const session = data?.session || null

      setSession(session)
      setAppState("CHECK_SESSION")

      if (!session?.user) {
        setUser(null)
        setAppState("AUTH")
        return
      }

      const profile = await getUserApi(session.user.id)

      if (profile?.id && profile?.artist_name) {
        setUser(profile)
        setAppState("READY")
      } else {
        setUser(null)
        setAppState("PROFILE")
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {

        setSession(session)

        if (!session?.user) {
          setUser(null)
          setAppState("AUTH")
          return
        }

        const profile = await getUserApi(session.user.id)

        if (profile?.id && profile?.artist_name) {
          setUser(profile)
          setAppState("READY")
        } else {
          setUser(null)
          setAppState("PROFILE")
        }
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // =========================
  // 🔥 LOGIN GOOGLE
  // =========================
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    })

    if (error) {
      console.error("Google login error:", error)
    }
  }

  // =========================
  // LOGOUT
  // =========================
  const logout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setAppState("AUTH")
  }

  // =========================
  // REGISTER USER
  // =========================
  const registerUser = async (artistName) => {

    const clean = artistName?.trim()
    if (!clean || !session?.user?.id) return null

    await createUserApi({
      id: session.user.id,
      artistName: clean
    })

    const profile = await getUserApi(session.user.id)

    setUser(profile)
    setAppState("READY")

    return profile
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

  const editSong = (id, data) => editSongApi(id, data)
  const cancelSong = (id) => cancelSongApi(id)
  const playNextSong = () => nextSongApi()
  const playNow = (id) => playNowApi(id)
  const removeSongById = (id) => removeSongApi(id)

  // =========================
  // FLAGS
  // =========================
  const isBooting = appState === "BOOTING"
  const isChecking = appState === "CHECK_SESSION"
  const isAuth = appState === "AUTH"
  const isProfile = appState === "PROFILE"
  const isReady = appState === "READY"

  return (
    <KaraokeContext.Provider value={{

      appState,
      isBooting,
      isChecking,
      isAuth,
      isProfile,
      isReady,

      session,
      user,

      registerUser,
      loginWithGoogle,
      logout,

      queue: safeQueue,
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