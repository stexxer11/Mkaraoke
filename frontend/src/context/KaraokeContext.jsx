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
  // DEVICE ID (REAL MULTIUSER)
  // =====================================================

  const [deviceId] =
    useState(() => {

      const existingId =
        localStorage.getItem(
          "mk_device_id"
        )

      if (existingId) {

        return existingId

      }

      const newId =
        crypto.randomUUID()

      localStorage.setItem(
        "mk_device_id",
        newId
      )

      return newId

    })

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

  // =====================================================
  // CONNECT SOCKET
  // =====================================================

  useEffect(() => {

    const ws =
      new WebSocket(

        `${import.meta.env.VITE_WS_URL.replace(
          "https",
          "wss"
        )}/ws`

      )

    socketRef.current = ws

    // =========================================
    // OPEN
    // =========================================

    ws.onopen = () => {

      console.log(
        "WS CONNECTED"
      )

      console.log(
        "DEVICE ID:",
        deviceId
      )

    }

    // =========================================
    // MESSAGE
    // =========================================

    ws.onmessage = (
      event
    ) => {

      try {

        const data =
          JSON.parse(
            event.data
          )

        // =====================================
        // QUEUE UPDATE
        // =====================================

        if (
          data.type ===
          "queue_update"
        ) {

          console.log(
            "QUEUE UPDATE:",
            data.queue
          )

          setQueue(
            data.queue || []
          )

        }

        // =====================================
        // PLAYER EVENTS
        // =====================================

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
          "WS PARSE ERROR",
          err
        )

      }

    }

    // =========================================
    // ERROR
    // =========================================

    ws.onerror = (
      err
    ) => {

      console.log(
        "WS ERROR",
        err
      )

    }

    // =========================================
    // CLOSE
    // =========================================

    ws.onclose = () => {

      console.log(
        "WS CLOSED"
      )

    }

    // =========================================
    // CLEANUP
    // =========================================

    return () => {

      ws.close()

    }

  }, [deviceId])

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

          String(
            song.ownerId
          ) ===
          String(deviceId)

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

      console.log(
        "ADDING SONG WITH DEVICE:",
        deviceId
      )

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

      console.log(err)

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

    } catch (err) {

      console.log(err)

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

      } catch (err) {

        console.log(err)

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

    } catch (err) {

      console.log(err)

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

  const moveSongUp =
    () => {}

  // =====================================================
  // MOVE SONG DOWN
  // =====================================================

  const moveSongDown =
    () => {}

  // =====================================================
  // REORDER QUEUE
  // =====================================================

  const reorderQueue =
    () => {}

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

        // =====================================
        // STATE
        // =====================================

        queue,
        visibleQueue,
        activeQueue,
        currentSong,

        // =====================================
        // PLAYER
        // =====================================

        playerVersion,

        // =====================================
        // USER
        // =====================================

        deviceId,
        mySongs,
        hasActiveSong,

        // =====================================
        // USER ACTIONS
        // =====================================

        addSong,
        editSong,
        cancelSong,

        // =====================================
        // PLAYER ACTIONS
        // =====================================

        playNextSong,

        // =====================================
        // ADMIN
        // =====================================

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