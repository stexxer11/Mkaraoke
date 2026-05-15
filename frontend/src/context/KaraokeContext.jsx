import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

const KaraokeContext = createContext()

export const KaraokeProvider = ({ children }) => {

  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [queue, setQueue] = useState([])
  const [loadingUser, setLoadingUser] = useState(true)

  // =========================
  // AUTH LISTENER
  // =========================
  useEffect(() => {
    const initSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session ?? null)
    }

    initSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // =========================
  // LOAD PROFILE (SAFE)
  // =========================
  useEffect(() => {
    const loadUser = async () => {
      if (!session?.user?.id) {
        setUser(null)
        setLoadingUser(false)
        return
      }

      setLoadingUser(true)

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle()

      if (error) {
        console.error("PROFILE ERROR:", error)
        setUser(null)
        setLoadingUser(false)
        return
      }

      setUser(data ?? null)
      setLoadingUser(false)
    }

    loadUser()
  }, [session])

  // =========================
  // LOGIN GOOGLE
  // =========================
  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google"
    })
  }

  // =========================
  // LOGOUT
  // =========================
  const logout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setQueue([])
  }

  // =========================
  // REGISTER / CREATE PROFILE
  // =========================
  const registerUser = async (artistName) => {
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) return

    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: authUser.id,
        artist_name: artistName
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error("REGISTER ERROR:", error)
      return
    }

    setUser(data)
  }

  // =========================
  // LOAD QUEUE
  // =========================
  const loadQueue = async () => {
    const { data, error } = await supabase
      .from("queue")
      .select("*")
      .order("created_at", { ascending: true })

    if (error) {
      console.error("QUEUE ERROR:", error)
      return
    }

    setQueue(data || [])
  }

  // =========================
  // ADD SONG
  // =========================
  const addSong = async (song) => {
    if (!session?.user?.id) return

    const newSong = {
      ...song,
      owner_id: session.user.id,
      status: "pending"
    }

    const { data, error } = await supabase
      .from("queue")
      .insert(newSong)
      .select()

    if (error) {
      console.error("ADD SONG ERROR:", error)
      return
    }

    setQueue(prev => [...prev, data[0]])
  }

  // =========================
  // REALTIME QUEUE
  // =========================
  useEffect(() => {
    loadQueue()

    const channel = supabase
      .channel("queue-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        () => {
          loadQueue()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // =========================
  // CONTEXT VALUE
  // =========================
  return (
    <KaraokeContext.Provider value={{
      session,
      user,
      queue,
      loadingUser,
      loginWithGoogle,
      logout,
      registerUser,
      addSong,
      loadQueue
    }}>
      {children}
    </KaraokeContext.Provider>
  )
}

export const useKaraoke = () => useContext(KaraokeContext)