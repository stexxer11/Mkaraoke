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
  // PLAYER VERSION
  // =====================================================

  const [playerVersion, setPlayerVersion] =
    useState(0)

  // =====================================================
  // WEBSOCKET
  // =====================================================

  const socketRef =
    useRef(null)

  useEffect(() => {

    const ws = new WebSocket(

      `${import.meta.env.VITE_WS_URL.replace(
        "https",
        "wss"
      )}/ws`

    )

    socketRef.current = ws

    ws.onopen = () => {

      console.log(
        "WS CONNECTED"
      )

    }

    ws.onmessage = (
      event
    ) => {

      try {

        const data =
          JSON.parse(
            event.data
          )

        // ============================
        // QUEUE UPDATE
        // ============================

        if (
          data.type ===
          "queue_update"
        ) {

          setQueue(
            data.queue || []
          )

        }

        // ============================
        // PLAYER EVENTS
        // ============================

        if (

          data.type ===
            "LOAD_VIDEO" ||

          data.type ===
            "STOP_VIDEO"

        ) {

          setPlayerVersion(
            prev => prev + 1
          )

        }

      } catch (err) {

        console.log(
          "WS ERROR",
          err
        )

      }

    }

    ws.onerror = (err) => {

      console.log(
        "WS ERROR",
        err
      )

    }

    ws.onclose = () => {

      console.log(
        "WS CLOSED"
      )

      // ============================
      // AUTO RECONNECT
      // ============================

      setTimeout(() => {

        window.location.reload()

      }, 2000)

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

      return queue.find(

        song =>
          song.status ===
          "playing"

      ) || null

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
  // ADD SONG
  // =====================================================

  const addSong = async (
    songData
  ) => {

    try {

      return await addSongApi({

        ownerId:
          deviceId,

        title:
          songData.title,

        artist:
          songData.artist,

        youtubeId:
          songData.youtubeId,

      })

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

      return await editSongApi(
        songId,
        data
      )

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

        return await cancelSongApi(
          songId
        )

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

      return await playNowApi(
        songId
      )

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

      } catch (err) {

        console.log(err)

      }

    }

  // =====================================================
  // MOVE SONG UP
  // =====================================================

  const moveSongUp = () => {}

  // =====================================================
  // MOVE SONG DOWN
  // =====================================================

  const moveSongDown = () => {}

  // =====================================================
  // REORDER QUEUE
  // =====================================================

  const reorderQueue = () => {}

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