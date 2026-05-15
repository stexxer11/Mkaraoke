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
  // STATE
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
    () =>
      safeQueue.find(
        (song) => song?.status === "playing"
      ) || null,
    [safeQueue]
  )

  // =========================
  // SAFE PROFILE FETCH
  // =========================
  const loadUserProfile = async (userId) => {

    try {

      const profile = await getUserApi(userId)

      if (profile?.id && profile?.artist_name) {

        setUser(profile)
        setAppState("READY")

        return profile
      }

      setUser(null)
      setAppState("PROFILE")

      return null

    } catch (error) {

      console.error("LOAD USER ERROR:", error)

      // evita crash infinito
      setUser(null)
      setAppState("PROFILE")

      return null
    }
  }

  // =========================
  // INIT AUTH
  // =========================
  useEffect(() => {

    let mounted = true

    const init = async () => {

      try {

        setAppState("BOOTING")

        const { data, error } =
          await supabase.auth.getSession()

        if (error) {
          console.error("SESSION ERROR:", error)

          if (mounted) {
            setSession(null)
            setUser(null)
            setAppState("AUTH")
          }

          return
        }

        const currentSession = data?.session || null

        if (!mounted) return

        setSession(currentSession)

        if (!currentSession?.user?.id) {
          setUser(null)
          setAppState("AUTH")
          return
        }

        await loadUserProfile(
          currentSession.user.id
        )

      } catch (error) {

        console.error("INIT ERROR:", error)

        if (mounted) {
          setSession(null)
          setUser(null)
          setAppState("AUTH")
        }
      }
    }

    init()

    // =========================
    // AUTH LISTENER
    // =========================
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {

        try {

          setSession(newSession)

          if (!newSession?.user?.id) {
            setUser(null)
            setAppState("AUTH")
            return
          }

          await loadUserProfile(
            newSession.user.id
          )

        } catch (error) {

          console.error(
            "AUTH STATE ERROR:",
            error
          )

          setUser(null)
          setAppState("PROFILE")
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }

  }, [])

  // =========================
  // LOGIN GOOGLE
  // =========================
  const loginWithGoogle = async () => {

    try {

      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/`
          },
        })

      if (error) {
        console.error(
          "GOOGLE LOGIN ERROR:",
          error
        )
      }

    } catch (error) {

      console.error(
        "LOGIN CRASH:",
        error
      )
    }
  }

  // =========================
  // LOGOUT
  // =========================
  const logout = async () => {

    try {

      await supabase.auth.signOut()

    } catch (error) {

      console.error(
        "LOGOUT ERROR:",
        error
      )

    } finally {

      setSession(null)
      setUser(null)
      setAppState("AUTH")
    }
  }

  // =========================
  // REGISTER USER
  // =========================
  const registerUser = async (artistName) => {

    try {

      const clean = artistName?.trim()

      if (!clean) {
        throw new Error("INVALID_ARTIST_NAME")
      }

      if (!session?.user?.id) {
        throw new Error("NO_SESSION")
      }

      await createUserApi({
        id: session.user.id,
        artistName: clean,
      })

      const profile =
        await loadUserProfile(
          session.user.id
        )

      return profile

    } catch (error) {

      console.error(
        "REGISTER USER ERROR:",
        error
      )

      throw error
    }
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

  const editSong = (id, data) =>
    editSongApi(id, data)

  const cancelSong = (id) =>
    cancelSongApi(id)

  const playNextSong = () =>
    nextSongApi()

  const playNow = (id) =>
    playNowApi(id)

  const removeSongById = (id) =>
    removeSongApi(id)

  // =========================
  // FLAGS
  // =========================
  const isBooting =
    appState === "BOOTING"

  const isAuth =
    appState === "AUTH"

  const isProfile =
    appState === "PROFILE"

  const isReady =
    appState === "READY"

  return (
    <KaraokeContext.Provider
      value={{

        appState,

        isBooting,
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
      }}
    >
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}