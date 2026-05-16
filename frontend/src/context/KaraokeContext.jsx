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

    supabase.auth.getSession().then(async ({ data }) => {

      setSession(data.session)

      if (data.session?.user) {

        const authUser = data.session.user

        const { data: profile } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single()

        setUser(profile)
      }

      setLoading(false)
    })

    const {
      data: authListener
    } = supabase.auth.onAuthStateChange(
      async (_, session) => {

        setSession(session)

        if (session?.user) {

          const authUser = session.user

          const { data: profile } = await supabase
            .from("users")
            .select("*")
            .eq("id", authUser.id)
            .single()

          setUser(profile)

        } else {
          setUser(null)
        }
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }

  }, [])

  // =====================================================
  // REALTIME
  // =====================================================

  useEffect(() => {

    loadSongs()

    const channel = supabase
      .channel("songs-realtime")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "songs",
        },
        () => {
          loadSongs()
        }
      )

      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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