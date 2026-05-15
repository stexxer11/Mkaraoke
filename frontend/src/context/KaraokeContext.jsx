import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef
} from "react"

import { supabase } from "../lib/supabase"
import { loginWithGoogle, logout } from "../services/auth"
import { getUserProfile } from "../services/users"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const profileFetchedRef = useRef(false)

  // =========================
  // LOAD PROFILE SAFE
  // =========================
  const loadProfile = async (userId) => {
    if (!userId) return

    try {
      setProfileLoading(true)

      const profile = await getUserProfile(userId)

      setUser(profile || null)
      profileFetchedRef.current = true

    } catch (err) {
      console.error("PROFILE ERROR:", err)

      // si falla por RLS o 403, NO romper la app
      setUser(null)

    } finally {
      setProfileLoading(false)
    }
  }

  // =========================
  // INIT AUTH
  // =========================
  useEffect(() => {

    let mounted = true

    async function init() {
      try {

        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error("SESSION ERROR:", error)
        }

        const session = data?.session || null

        if (!mounted) return

        setSession(session)

        if (session?.user?.id) {
          await loadProfile(session.user.id)
        }

      } catch (e) {
        console.error("INIT AUTH ERROR:", e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    // =========================
    // LISTENER AUTH CHANGE
    // =========================
    const { data: listener } =
      supabase.auth.onAuthStateChange(
        async (_, newSession) => {

          setSession(newSession)

          setUser(null)
          profileFetchedRef.current = false

          if (newSession?.user?.id) {
            await loadProfile(newSession.user.id)
          }
        }
      )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }

  }, [])

  // =========================
  // SAFE UPSERT USER PROFILE
  // =========================
  async function setArtistName(name) {

    if (!session?.user?.id) return

    try {

      const { data, error } = await supabase
        .from("users")
        .upsert({
          id: session.user.id,
          email: session.user.email,
          artist_name: name
        })
        .select()
        .single()

      if (error) throw error

      setUser(data)
      return data

    } catch (err) {
      console.error("SET ARTIST ERROR:", err)
      throw err
    }
  }

  // =========================
  // REFRESH PROFILE MANUAL
  // =========================
  async function refreshProfile() {
    if (!session?.user?.id) return
    await loadProfile(session.user.id)
  }

  return (
    <KaraokeContext.Provider value={{
      session,
      user,
      loading,
      profileLoading,

      loginWithGoogle,
      logout,
      setArtistName,
      refreshProfile
    }}>
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}