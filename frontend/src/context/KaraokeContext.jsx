import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  addSongApi,
  editSongApi,
  cancelSongApi,
  nextSongApi,
  playNowApi,
  removeSongApi,
  getUserApi,
  createUserApi,
} from "../services/karaokeApi"

import { supabase } from "../lib/supabase"

const KaraokeContext = createContext()

export function KaraokeProvider({ children }) {

  // =========================
  // AUTH
  // =========================
  const [session, setSession] = useState(null)

  // =========================
  // USER STATE
  // =========================
  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  // =========================
  // QUEUE STATE
  // =========================
  const [queue, setQueue] = useState([])
  const [playerVersion, setPlayerVersion] = useState(0)

  // =========================
  // SOCKET
  // =========================
  const socketRef = useRef(null)
  const reconnectRef = useRef(0)
  const reconnectTimeoutRef = useRef(null)

  // =========================
  // AUTH INIT
  // =========================
  useEffect(() => {

    let mounted = true

    const initAuth = async () => {

      try {

        // sesión existente
        const {
          data: { session }
        } = await supabase.auth.getSession()

        if (session?.user) {

          if (mounted) {
            setSession(session)
          }

          return
        }

        // login anónimo
        const {
          data,
          error
        } = await supabase.auth.signInAnonymously()

        if (error) {
          throw error
        }

        if (mounted) {
          setSession(data.session)
        }

      } catch (error) {

        console.log("AUTH ERROR:", error)
      }
    }

    initAuth()

    const {
      data: listener
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }

  }, [])

  // =========================
  // USER ID
  // =========================
  const userId = session?.user?.id

  // =========================
  // LOAD USER
  // =========================
  useEffect(() => {

    if (!userId) return

    let mounted = true

    const loadUser = async () => {

      setLoadingUser(true)

      try {

        const res = await getUserApi()

        if (!mounted) return

        if (res?.id) {
          setUser(res)
        } else {
          setUser(null)
        }

      } catch (err) {

        console.log("GET USER ERROR:", err)

        if (mounted) {
          setUser(null)
        }

      } finally {

        if (mounted) {
          setLoadingUser(false)
        }
      }
    }

    loadUser()

    return () => {
      mounted = false
    }

  }, [userId])

  // =========================
  // REGISTER USER
  // =========================
  const registerUser = async (artistName) => {

    try {

      const cleanName = artistName?.trim()

      if (!cleanName) {
        throw new Error("Nombre inválido")
      }

      const payload = {
        id: userId,
        artist_name: cleanName
      }

      await createUserApi(payload)

      setUser(payload)

      return payload

    } catch (err) {

      console.log("CREATE USER ERROR:", err)

      return null
    }
  }

  // =========================
  // DERIVED STATE
  // =========================
  const currentSong = useMemo(
    () =>
      queue.find(
        s => s.status === "playing"
      ) || null,
    [queue]
  )

  const activeQueue = useMemo(
    () =>
      queue.filter(
        s =>
          s.status === "queued" ||
          s.status === "playing"
      ),
    [queue]
  )

  const mySongs = useMemo(
    () =>
      activeQueue.filter(
        s =>
          String(s.owner_id) ===
          String(userId)
      ),
    [activeQueue, userId]
  )

  const visibleQueue = useMemo(
    () =>
      queue.filter(
        s =>
          s.status !== "done" &&
          s.status !== "cancelled"
      ),
    [queue]
  )

  // =========================
  // SAFE WS SEND
  // =========================
  const safeSend = (data) => {

    const ws = socketRef.current

    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN
    ) {
      return
    }

    ws.send(JSON.stringify(data))
  }

  // =========================
  // WEBSOCKET
  // =========================
  useEffect(() => {

    if (!userId) return

    let shouldReconnect = true

    const connect = () => {

      const url =
        `${import.meta.env.VITE_WS_URL.replace("https", "wss")}/ws`

      const ws = new WebSocket(url)

      socketRef.current = ws

      ws.onopen = () => {

        reconnectRef.current = 0

        safeSend({
          type: "GET_STATE",
          userId
        })
      }

      ws.onmessage = (event) => {

        try {

          const data = JSON.parse(event.data)

          if (data.type === "queue_update") {
            setQueue(data.queue || [])
          }

          if (
            data.type === "LOAD_VIDEO" ||
            data.type === "STOP_VIDEO"
          ) {
            setPlayerVersion(v => v + 1)
          }

        } catch (err) {

          console.log(
            "WS PARSE ERROR",
            err
          )
        }
      }

      ws.onerror = () => {
        console.log("WS ERROR")
      }

      ws.onclose = () => {

        if (!shouldReconnect) return

        const timeout = Math.min(
          1000 * 2 ** reconnectRef.current,
          10000
        )

        reconnectRef.current += 1

        reconnectTimeoutRef.current =
          setTimeout(connect, timeout)
      }
    }

    connect()

    return () => {

      shouldReconnect = false

      if (reconnectTimeoutRef.current) {
        clearTimeout(
          reconnectTimeoutRef.current
        )
      }

      socketRef.current?.close()
    }

  }, [userId])

  // =========================
  // ACTIONS
  // =========================
  const addSong = async (songData) => {

    try {

      return await addSongApi({

        owner_id: userId,

        title: songData.title,
        artist: songData.artist,
        youtubeId: songData.youtubeId,
      })

    } catch (err) {

      return {
        ok: false,
        error: err?.message
      }
    }
  }

  const editSong = async (id, data) =>
    editSongApi(id, data)
      .catch(() => ({ ok: false }))

  const cancelSong = async (id) =>
    cancelSongApi(id)
      .catch(() => ({ ok: false }))

  const playNextSong = async () =>
    nextSongApi()
      .catch(console.log)

  const playNow = async (id) =>
    playNowApi(id)
      .catch(() => ({ ok: false }))

  const removeSongById = async (id) =>
    removeSongApi(id)
      .catch(console.log)

  // =========================
  // PROVIDER
  // =========================
  return (

    <KaraokeContext.Provider
      value={{

        queue,
        visibleQueue,
        activeQueue,
        currentSong,

        playerVersion,

        mySongs,

        session,
        user,
        loadingUser,

        registerUser,

        addSong,
        editSong,
        cancelSong,

        playNextSong,
        playNow,
        removeSongById,

        safeSend,
      }}
    >

      {children}

    </KaraokeContext.Provider>
  )
}

export function useKaraoke() {
  return useContext(KaraokeContext)
}