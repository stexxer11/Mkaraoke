import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react"

import { supabase } from "../lib/supabase"
import { loginWithGoogle, logout } from "../services/auth"
import { getUserProfile } from "../services/users"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // =========================
  // INIT
  // =========================
  useEffect(() => {

    const init = async () => {

      const { data } = await supabase.auth.getSession()
      const session = data.session

      setSession(session)

      if (session?.user?.id) {

        const profile = await getUserProfile(session.user.id)

        setUser(profile) // puede ser null

      }

      setLoading(false)
    }

    init()

    const { data: listener } =
      supabase.auth.onAuthStateChange(
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

    return () => listener.subscription.unsubscribe()

  }, [])

  // =========================
  // SET ARTIST NAME
  // =========================
  async function setArtistName(name) {

    if (!session?.user?.id) return

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
  }

  return (
    <KaraokeContext.Provider
      value={{
        session,
        user,
        loading,
        loginWithGoogle,
        logout,
        setArtistName
      }}
    >
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}