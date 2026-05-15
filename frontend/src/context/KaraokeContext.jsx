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

  const initDone = useRef(false)

  // =========================
  // CREATE OR UPDATE USER
  // =========================
  const upsertUser = async (authUser) => {

    if (!authUser?.id) return null

    const { data, error } = await supabase
      .from("users")
      .upsert({
        id: authUser.id,
        email: authUser.email,
        artist_name: authUser.user_metadata?.name || null,
        avatar_url: authUser.user_metadata?.avatar_url || null
      })
      .select()
      .single()

    if (error) {
      console.error("UPSERT USER ERROR:", error)
      return null
    }

    return data
  }

  // =========================
  // LOAD PROFILE
  // =========================
  const loadProfile = async (authUser) => {

    if (!authUser?.id) return

    try {
      setProfileLoading(true)

      let profile = await getUserProfile(authUser.id)

      // si no existe → lo creamos
      if (!profile) {
        profile = await upsertUser(authUser)
      }

      setUser(profile)

    } catch (err) {
      console.error("PROFILE ERROR:", err)
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

    const init = async () => {

      const { data } = await supabase.auth.getSession()
      const session = data?.session || null

      if (!mounted) return

      setSession(session)

      if (session?.user && !initDone.current) {
        initDone.current = true
        await loadProfile(session.user)
      }

      setLoading(false)
    }

    init()

    // =========================
    // AUTH CHANGE
    // =========================
    const { data: listener } =
      supabase.auth.onAuthStateChange(async (_, newSession) => {

        setSession(newSession)

        if (newSession?.user) {
          await loadProfile(newSession.user)
        } else {
          setUser(null)
        }

      })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }

  }, [])

  // =========================
  // SET ARTIST NAME
  // =========================
  async function setArtistName(name) {

    if (!session?.user) return

    const { data, error } = await supabase
      .from("users")
      .update({
        artist_name: name
      })
      .eq("id", session.user.id)
      .select()
      .single()

    if (error) {
      console.error("SET ARTIST ERROR:", error)
      throw error
    }

    setUser(data)
    return data
  }

  // =========================
  // REFRESH PROFILE
  // =========================
  async function refreshProfile() {
    if (!session?.user) return
    await loadProfile(session.user)
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