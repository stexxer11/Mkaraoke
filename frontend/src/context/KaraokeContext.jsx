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
  // INIT SESSION
  // =========================
  useEffect(() => {

    async function initialize() {

      try {

        const {
          data
        } = await supabase.auth.getSession()

        const currentSession = data.session

        setSession(currentSession)

        if (currentSession?.user?.id) {

          const profile = await getUserProfile(
            currentSession.user.id
          )

          setUser(profile)
        }

      } catch (e) {

        console.error("Session init error:", e)

      } finally {

        setLoading(false)

      }
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

          const profile = await getUserProfile(
            newSession.user.id
          )

          setUser(profile)

        } else {

          setUser(null)

        }
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }

  }, [])

  // =========================
  // REGISTER USER
  // =========================
async function registerUser(artistName) {

  if (!session?.user) {
    throw new Error("No session user")
  }

  const profile = await createUserProfile(
    session.user,
    artistName
  )

  console.log("PROFILE CREATED:", profile)

  // FORZAR USER LOCAL
  setUser(profile)

  return profile
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