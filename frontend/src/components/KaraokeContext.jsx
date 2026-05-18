import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"

import { supabase } from "../lib/supabase"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)

  const [queue, setQueue] = useState([])
  const [currentSong, setCurrentSong] = useState(null)

  const [loading, setLoading] = useState(true)

  // =====================================================
  // AUTH
  // =====================================================

  async function loginWithGoogle() {

    await supabase.auth.signInWithOAuth({
      provider: "google",
    })
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  // =====================================================
  // LOAD SONGS
  // =====================================================

  async function loadSongs() {

    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    const playing =
      data.find((s) => s.status === "playing") || null

    const queued =
      data.filter((s) => s.status === "queued")

    setCurrentSong(playing)
    setQueue(queued)
  }

  // =====================================================
  // ADD SONG
  // =====================================================

  async function addSong(song) {

    if (!user) return

    const { error } = await supabase
      .from("songs")
      .insert({
        user_id: user.id,
        youtube_id: song.youtubeId,
        title: song.title,
        artist: song.artist,
        thumbnail: song.thumbnail,
        status: "queued",
      })

    if (error) {
      console.error(error)
    }
  }

  // =====================================================
  // REMOVE SONG
  // =====================================================

  async function removeSongById(id) {

    await supabase
      .from("songs")
      .delete()
      .eq("id", id)
  }

  // =====================================================
  // PLAY NOW
  // =====================================================

  async function playNow(id) {

    await supabase
      .from("songs")
      .update({
        status: "queued"
      })
      .eq("status", "playing")

    await supabase
      .from("songs")
      .update({
        status: "playing"
      })
      .eq("id", id)
  }

  // =====================================================
  // NEXT SONG
  // =====================================================

  async function playNextSong() {

    if (currentSong) {
      await supabase
        .from("songs")
        .delete()
        .eq("id", currentSong.id)
    }

    const next = queue[0]

    if (!next) {
      setCurrentSong(null)
      return
    }

    await playNow(next.id)
  }

  // =====================================================
  // ARTIST NAME
  // =====================================================

  async function setArtistName(name) {

    if (!session?.user) return

    const payload = {
      id: session.user.id,
      email: session.user.email,
      artist_name: name,
      avatar_url:
        session.user.user_metadata?.avatar_url || null,
    }

    const { data, error } = await supabase
      .from("users")
      .upsert(payload)
      .select()
      .single()

    if (error) {
      console.error(error)
      return
    }

    setUser(data)
  }

  // =====================================================
  // INIT
  // =====================================================
useEffect(() => {

  let mounted = true

  async function initialize() {

    try {

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setSession(session)

      if (session?.user) {

        const authUser = session.user

        // =========================================
        // CREATE PROFILE IF NOT EXISTS
        // =========================================

        const payload = {
          id: authUser.id,
          email: authUser.email,
          artist_name: null,
          avatar_url:
            authUser.user_metadata?.avatar_url || null,
        }

        await supabase
          .from("users")
          .upsert(payload)

        // =========================================
        // LOAD PROFILE
        // =========================================

        const {
          data: profile,
          error,
        } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle()

        console.log("PROFILE:", profile)
        console.log("PROFILE ERROR:", error)

        if (!mounted) return

        if (profile) {

          setUser(profile)

        } else {

          setUser({
            id: authUser.id,
            email: authUser.email,
            artist_name: null,
            avatar_url:
              authUser.user_metadata?.avatar_url || null,
          })
        }

      } else {

        setUser(null)
      }

    } catch (err) {

      console.error("INIT ERROR:", err)

    } finally {

      if (mounted) {
        setLoading(false)
      }
    }
  }

  initialize()

  // =========================================
  // AUTH LISTENER
  // =========================================

  const {
    data: authListener
  } = supabase.auth.onAuthStateChange(
    async (event, session) => {

      console.log("AUTH EVENT:", event)

      setSession(session)

      if (session?.user) {

        const authUser = session.user

        const payload = {
          id: authUser.id,
          email: authUser.email,
          artist_name: null,
          avatar_url:
            authUser.user_metadata?.avatar_url || null,
        }

        await supabase
          .from("users")
          .upsert(payload)

        const {
          data: profile,
          error,
        } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle()

        console.log("PROFILE:", profile)
        console.log("PROFILE ERROR:", error)

        if (profile) {

          setUser(profile)

        } else {

          setUser({
            id: authUser.id,
            email: authUser.email,
            artist_name: null,
            avatar_url:
              authUser.user_metadata?.avatar_url || null,
          })
        }

      } else {

        setUser(null)
      }
    }
  )

  return () => {

    mounted = false

    authListener.subscription.unsubscribe()
  }

}, [])
  return (
    <KaraokeContext.Provider
      value={{

        session,
        user,
        loading,

        queue,
        currentSong,

        loginWithGoogle,
        logout,

        addSong,
        removeSongById,

        playNow,
        playNextSong,

        setArtistName,
      }}
    >
      {children}
    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}