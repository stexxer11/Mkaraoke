import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

const KaraokeContext = createContext()

export const KaraokeProvider = ({ children }) => {

  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [queue, setQueue] = useState([])

  // =========================
  // AUTH LISTENER
  // =========================
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // =========================
  // LOAD USER PROFILE
  // =========================
  useEffect(() => {
    const loadUser = async () => {
      if (!session?.user) return

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()

      setUser(data)
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
  // REGISTER USER (ARTIST NAME)
  // =========================
  const registerUser = async (artistName) => {
    const { data: { user: authUser } } = await supabase.auth.getUser()

    const { data } = await supabase
      .from("profiles")
      .upsert({
        id: authUser.id,
        artist_name: artistName
      })

    setUser(data?.[0])
  }

  // =========================
  // QUEUE SYSTEM
  // =========================
  const addSong = async (song) => {
    const newSong = {
      ...song,
      owner_id: session.user.id,
      status: "pending"
    }

    const { data } = await supabase
      .from("queue")
      .insert(newSong)
      .select()

    setQueue(prev => [...prev, data[0]])
  }

  const loadQueue = async () => {
    const { data } = await supabase
      .from("queue")
      .select("*")
      .order("created_at", { ascending: true })

    setQueue(data || [])
  }

  useEffect(() => {
    loadQueue()

    const channel = supabase
      .channel("queue-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        payload => {
          loadQueue()
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return (
    <KaraokeContext.Provider value={{
      session,
      user,
      queue,
      loginWithGoogle,
      logout,
      registerUser,
      addSong,
    }}>
      {children}
    </KaraokeContext.Provider>
  )
}

export const useKaraoke = () => useContext(KaraokeContext)