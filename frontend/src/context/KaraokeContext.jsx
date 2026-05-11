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

} from "../services/karaokeApi"

const KaraokeContext =
  createContext()

export function KaraokeProvider({
  children
}) {

  // =====================================================
  // DEVICE ID
  // =====================================================

  const getDeviceId = () => {

    let id =
      localStorage.getItem(
        "mk_device_id"
      )

    if (!id) {

      id = crypto.randomUUID()

      localStorage.setItem(
        "mk_device_id",
        id
      )

    }

    return id

  }

  const [deviceId] =
    useState(getDeviceId)

  // =====================================================
  // QUEUE
  // =====================================================

  const [queue, setQueue] =
    useState([])

  // =====================================================
  // FORCE TV RELOAD
  // =====================================================

  const [playerVersion, setPlayerVersion] =
    useState(0)

  const reloadTvPlayer = () => {

    setPlayerVersion(prev => prev + 1)

  }

  // =====================================================
  // WEBSOCKET
  // =====================================================

  const socketRef =
    useRef(null)
useEffect(() => {

  const ws = new WebSocket(
    `${import.meta.env.VITE_WS_URL.replace("https", "wss")}/ws`
  )

  socketRef.current = ws

  ws.onopen = () => {
    console.log("WS CONNECTED")
  }

  ws.onmessage = (event) => {

    try {

      const data = JSON.parse(event.data)

      if (data.type === "queue_update") {
        setQueue(data.queue || [])
        reloadTvPlayer()
      }

      if (data.type === "force_reload") {
        reloadTvPlayer()
      }

    } catch (err) {
      console.log("WS PARSE ERROR", err)
    }

  }

  ws.onerror = (err) => {
    console.log("WS ERROR", err)
  }

  ws.onclose = () => {
    console.log("WS CLOSED")
  }

  return () => {
    ws.close()
  }

}, [])

  // =====================================================
  // CURRENT SONG
  // =====================================================

  const currentSong =
    useMemo(() => {

      return (

        queue.find(
          song =>
            song.status ===
            "playing"
        ) || null

      )

    }, [queue])

  // =====================================================
  // ACTIVE QUEUE
  // =====================================================

  const activeQueue =
    useMemo(() => {

      return queue.filter(

        song =>

          song.status ===
            "queued" ||

          song.status ===
            "playing"

      )

    }, [queue])

  // =====================================================
  // MY SONGS
  // =====================================================

  const mySongs =
    useMemo(() => {

      return activeQueue.filter(

        song =>
          song.ownerId ===
          deviceId

      )

    }, [

      activeQueue,
      deviceId

    ])

  // =====================================================
  // HAS ACTIVE SONG
  // =====================================================

  const hasActiveSong =
    mySongs.length > 0

  // =====================================================
  // FORCE BROADCAST
  // =====================================================

  const broadcastReload = () => {

    if (
      socketRef.current &&
      socketRef.current.readyState === 1
    ) {

      socketRef.current.send(

        JSON.stringify({

          type:
            "force_reload"

        })

      )

    }

  }

  // =====================================================
  // ADD SONG
  // =====================================================

  const addSong = async (
    songData
  ) => {

    try {

      const res =
        await addSongApi({

          ownerId:
            deviceId,

          title:
            songData.title,

          artist:
            songData.artist,

          youtubeId:
            songData.youtubeId,

        })

      broadcastReload()

      return res

    } catch (err) {

      return {

        ok: false,

        error:

          err?.response?.data
            ?.detail ||

          "Error agregando canción"

      }

    }

  }

  // =====================================================
  // EDIT SONG
  // =====================================================

  const editSong = async (
    songId,
    data
  ) => {

    try {

      const res =
        await editSongApi(
          songId,
          data
        )

      broadcastReload()

      return res

    } catch {

      return {
        ok: false
      }

    }

  }

  // =====================================================
  // CANCEL SONG
  // =====================================================

  const cancelSong =
    async (songId) => {

      try {

        const res =
          await cancelSongApi(
            songId
          )

        broadcastReload()

        return res

      } catch {

        return {
          ok: false
        }

      }

    }

  // =====================================================
  // NEXT SONG
  // =====================================================

  const playNextSong =
    async () => {

      try {

        await nextSongApi()

        reloadTvPlayer()

        broadcastReload()

      } catch (err) {

        console.log(err)

      }

    }

  // =====================================================
  // PLAY NOW
  // =====================================================

  const playNow = async (
    songId
  ) => {

    try {

      const res =
        await playNowApi(
          songId
        )

      reloadTvPlayer()

      broadcastReload()

      return res

    } catch {

      return {
        ok: false
      }

    }

  }

  // =====================================================
  // REMOVE SONG
  // =====================================================

  const removeSongById =
    async (songId) => {

      try {

        await removeSongApi(
          songId
        )

        reloadTvPlayer()

        broadcastReload()

      } catch (err) {

        console.log(err)

      }

    }

  // =====================================================
  // MOVE SONG UP
  // =====================================================

  const moveSongUp = (
    songId
  ) => {

    const updated = [
      ...activeQueue
    ]

    const index =
      updated.findIndex(
        s =>
          s.id === songId
      )

    if (index <= 0)
      return

    const current =
      updated[index]

    const previous =
      updated[index - 1]

    if (
      previous.status ===
      "playing"
    ) {
      return
    }

    updated[index - 1] =
      current

    updated[index] =
      previous

    setQueue(updated)

    reloadTvPlayer()

  }

  // =====================================================
  // MOVE SONG DOWN
  // =====================================================

  const moveSongDown = (
    songId
  ) => {

    const updated = [
      ...activeQueue
    ]

    const index =
      updated.findIndex(
        s =>
          s.id === songId
      )

    if (

      index === -1 ||

      index >=
        updated.length - 1

    ) {
      return
    }

    const current =
      updated[index]

    const next =
      updated[index + 1]

    updated[index] =
      next

    updated[index + 1] =
      current

    setQueue(updated)

    reloadTvPlayer()

  }

  // =====================================================
  // REORDER QUEUE
  // =====================================================

  const reorderQueue = (
    newQueue
  ) => {

    setQueue(newQueue)

    reloadTvPlayer()

  }

  // =====================================================
  // VISIBLE QUEUE
  // =====================================================

  const visibleQueue =
    useMemo(() => {

      return queue.filter(

        song =>

          song.status !==
            "done" &&

          song.status !==
            "cancelled"

      )

    }, [queue])

  // =====================================================
  // PROVIDER
  // =====================================================

  return (

    <KaraokeContext.Provider
      value={{

        // STATE
        queue,
        visibleQueue,
        activeQueue,
        currentSong,

        // PLAYER
        playerVersion,

        // USER
        deviceId,
        mySongs,
        hasActiveSong,

        // USER ACTIONS
        addSong,
        editSong,
        cancelSong,

        // PLAYER ACTIONS
        playNextSong,

        // ADMIN
        playNow,
        removeSongById,
        moveSongUp,
        moveSongDown,
        reorderQueue,

        // INTERNAL
        setQueue,
        reloadTvPlayer,

      }}
    >

      {children}

    </KaraokeContext.Provider>

  )

}

export function useKaraoke() {

  return useContext(
    KaraokeContext
  )

}