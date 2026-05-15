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
  getQueue,
} from "../services/karaokeApi"

import { supabase } from "../services/supabase"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [queue, setQueue] = useState([])

  const safeQueue = useMemo(() => Array.isArray(queue) ? queue : [], [queue])

  const currentSong = useMemo(
    () => safeQueue.find(s => s?.status === "playing") || null,
    [safeQueue]
  )

  const isBooting = session === undefined
  const isAuth = !session
  const isReady = !!session && !!user

  // =========================
  // LOAD USER
  // =========================
  const loadUserProfile = async (userId) => {
    try {
      const profile = await getUserApi(userId)

      if (!profile?.id) {
        setUser(null)
        return null
      }

      setUser(profile)
      return profile

    } catch (e) {
      console.error("USER LOAD ERROR:", e)
      setUser(null)
      return null
    }
  }

  // =========================
  // INIT AUTH
  // =========================
  useEffect(() => {

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data?.session || null

      setSession(session)

      if (!session?.user?.id) {
        setUser(null)
        return
      }

      await loadUserProfile(session.user.id)
    }

    init()

    const { data: listener } =
      supabase.auth.onAuthStateChange(async (_event, session) => {

        setSession(session)

        if (!session?.user?.id) {
          setUser(null)
          return
        }

        await loadUserProfile(session.user.id)
      })

    return () => listener.subscription.unsubscribe()

  }, [])

  // =========================
  // LOGIN GOOGLE
  // =========================
  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    })
  }

  // =========================
  // LOGOUT
  // =========================
  const logout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
  }

  // =========================
  // REGISTER USER
  // =========================
  const registerUser = async (artistName) => {
    const clean = artistName?.trim()

    if (!clean) throw new Error("INVALID_NAME")
    if (!session?.user?.id) throw new Error("NO_SESSION")

    await createUserApi({
      id: session.user.id,
      artistName: clean,
    })

    return await loadUserProfile(session.user.id)
  }

  // =========================
  // SONG ACTIONS
  // =========================
  const addSong = (song) =>
    addSongApi({
      ownerId: session?.user?.id,
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId,
    })

  const editSong = (id, data) => editSongApi(id, data)
  const cancelSong = (id) => cancelSongApi(id)
  const playNextSong = () => nextSongApi()
  const playNow = (id) => playNowApi(id)
  const removeSongById = (id) => removeSongApi(id)

  return (
    <KaraokeContext.Provider value={{

      session,
      user,

      queue,
      setQueue,
      currentSong,

      isBooting,
      isAuth,
      isReady,

      loginWithGoogle,
      logout,
      registerUser,

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