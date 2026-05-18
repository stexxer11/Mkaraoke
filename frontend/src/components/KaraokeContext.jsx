import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"

import { supabase } from "../lib/supabase"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  // =====================================================
  // STATE
  // =====================================================

  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)

  const [queue, setQueue] = useState([])
  const [currentSong, setCurrentSong] = useState(null)

  const [loading, setLoading] = useState(true)

  // =====================================================
  // LOGIN
  // =====================================================

  async function loginWithGoogle() {

    const { error } =
      await supabase.auth.signInWithOAuth({

        provider: "google",

        options: {
          redirectTo: window.location.origin,
        },
      })

    if (error) {
      console.error("LOGIN ERROR:", error)
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  async function logout() {

    const { error } =
      await supabase.auth.signOut()

    if (error) {
      console.error("LOGOUT ERROR:", error)
    }
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
      console.error("LOAD SONGS ERROR:", error)
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
      console.error("ADD SONG ERROR:", error)
    }
  }

  // =====================================================
  // REMOVE SONG
  // =====================================================

  async function removeSongById(id) {

    const { error } = await supabase
      .from("songs")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("REMOVE SONG ERROR:", error)
    }
  }

  // =====================================================
  // PLAY NOW
  // =====================================================

  async function playNow(id) {

    await supabase
      .from("songs")
      .update({
        status: "queued",
      })
      .eq("status", "playing")

    await supabase
      .from("songs")
      .update({
        status: "playing",
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

    const {
      data,
      error,
    } = await supabase
      .from("users")
      .upsert(payload)
      .select()
      .maybeSingle()

    if (error) {
      console.error("ARTIST NAME ERROR:", error)
      return
    }

    setUser(data)
  }

  // =====================================================
  // CREATE / LOAD PROFILE
  // =====================================================

  async function loadProfile(authUser) {

    try {

      const payload = {
        id: authUser.id,
        email: authUser.email,
        artist_name: null,
        avatar_url:
          authUser.user_metadata?.avatar_url || null,
      }

      const {
        error: upsertError,
      } = await supabase
        .from("users")
        .upsert(payload)

      console.log("UPSERT ERROR:", upsertError)

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle()

      console.log("PROFILE:", profile)
      console.log("PROFILE ERROR:", profileError)

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

      await loadSongs()

    } catch (err) {

      console.error("LOAD PROFILE ERROR:", err)
    }
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

        console.log("INITIAL SESSION:", session)

        if (!mounted) return

        setSession(session)

        if (session?.user) {

          await loadProfile(session.user)

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

    // =================================================
    // AUTH LISTENER
    // =================================================

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        console.log("AUTH EVENT:", event)
        console.log("AUTH SESSION:", session)

        setSession(session)

        if (session?.user) {

          await loadProfile(session.user)

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

  // =====================================================
  // REALTIME
  // =====================================================

  useEffect(() => {

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

          console.log("SONGS UPDATED")

          loadSongs()
        }
      )

      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }

  }, [])

  // =====================================================
  // PROVIDER
  // =====================================================

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