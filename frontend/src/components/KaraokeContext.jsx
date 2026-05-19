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

    setSession(null)
    setUser(null)
  }

  // =====================================================
  // LOAD SONGS
  // =====================================================

  async function loadSongs() {

    try {

      console.log("LOADING SONGS")

      const {
        data,
        error,
      } = await supabase
        .from("songs")
        .select("*")
        .order("created_at", {
          ascending: true,
        })

      console.log("SONGS:", data)
      console.log("SONGS ERROR:", error)

      if (error) return

      const playing =
        data.find(
          (s) => s.status === "playing"
        ) || null

      const queued =
        data.filter(
          (s) => s.status === "queued"
        )

      setCurrentSong(playing)
      setQueue(queued)

    } catch (err) {

      console.error(
        "LOAD SONGS CRASH:",
        err
      )
    }
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
      console.error(
        "ADD SONG ERROR:",
        error
      )
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
      console.error(
        "REMOVE SONG ERROR:",
        error
      )
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

    setUser((prev) => ({
      ...prev,
      artist_name: name,
    }))
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

        console.log(
          "INITIAL SESSION:",
          session
        )

        if (!mounted) return

        setSession(session)

        if (session?.user) {

          const authUser =
            session.user

          setUser({
            id: authUser.id,
            email: authUser.email,

            artist_name:
              authUser.user_metadata
                ?.full_name || null,

            avatar_url:
              authUser.user_metadata
                ?.avatar_url || null,
          })

          // =========================
          // TEMPORARILY DISABLED
          // =========================

          // await loadSongs()

        } else {

          setUser(null)
        }

      } catch (err) {

        console.error(
          "INIT ERROR:",
          err
        )

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

        console.log(
          "AUTH EVENT:",
          event
        )

        // =====================================
        // IGNORE EXTRA EVENTS
        // =====================================

        if (
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          return
        }

        // =====================================
        // SIGNED OUT
        // =====================================

        if (event === "SIGNED_OUT") {

          setSession(null)
          setUser(null)

          return
        }

        // =====================================
        // VALID SESSION
        // =====================================

        if (session?.user) {

          setSession(session)

          const authUser =
            session.user

          setUser({
            id: authUser.id,
            email: authUser.email,

            artist_name:
              authUser.user_metadata
                ?.full_name || null,

            avatar_url:
              authUser.user_metadata
                ?.avatar_url || null,
          })

          // =========================
          // TEMPORARILY DISABLED
          // =========================

          // await loadSongs()
        }
      }
    )

    return () => {

      mounted = false

      authListener
        .subscription
        .unsubscribe()
    }

  }, [])

  // =====================================================
  // REALTIME TEMP DISABLED
  // =====================================================

  /*
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
  */

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