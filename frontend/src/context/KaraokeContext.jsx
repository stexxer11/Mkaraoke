import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react"

import { supabase } from "../lib/supabase"

import {
  loginWithGoogle,
  logout
} from "../services/auth"

import {
  createUserProfile,
  getUserProfile
} from "../services/users"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  const [session, setSession] = useState(undefined)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // =========================
  // GET OR CREATE USER
  // =========================
  const ensureUser = async (authUser) => {

    const userId = authUser.id

    console.log("CHECKING USER:", userId)

    let profile = await getUserProfile(userId)

    console.log("PROFILE FOUND:", profile)

    if (!profile) {

      console.log("CREATING MISSING PROFILE")

      const { data, error } = await supabase
        .from("users")
        .insert({
          id: userId,
          email: authUser.email,
          artist_name: null
        })
        .select()
        .single()

      if (error) {
        console.error("CREATE USER ERROR:", error)
        return null
      }

      profile = data
    }

    setUser(profile)
  }

  // =========================
  // INIT SESSION
  // =========================
  useEffect(() => {

    async function initialize() {

      const { data } = await supabase.auth.getSession()

      const session = data.session

      setSession(session)

      if (session?.user?.id) {
        await ensureUser(session.user)
      }

      setLoading(false) // 🔥 ESTE TE FALTABA
    }

    initialize()

    // =========================
    // AUTH LISTENER
    // =========================
    const {
      data: listener
    } = supabase.auth.onAuthStateChange(
      async (_, newSession) => {

        setSession(newSession)

        if (newSession?.user?.id) {
          await ensureUser(newSession.user)
        } else {
          setUser(null)
        }

        setLoading(false)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }

  }, [])

  // =========================
  // REGISTER USER (NOMBRE ARTÍSTICO)
  // =========================
  async function registerUser(artistName) {

    if (!session?.user) {
      throw new Error("No session user")
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        artist_name: artistName
      })
      .eq("id", session.user.id)
      .select()
      .single()

    if (error) throw error

    setUser(data)

    return data
  }

  // =========================
  // CONTEXT VALUE
  // =========================
  const value = {
    session,
    user,
    loading,
    loginWithGoogle,
    logout,
    registerUser
  }

  return (
    <KaraokeContext.Provider value={value}>
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}