import { useEffect, useRef, useState } from "react"
import YouTube from "react-youtube"

import { useKaraoke } from "../context/KaraokeContext"

function TvPage() {

  const {
    playNextSong,
  } = useKaraoke()

  // =====================================================
  // STATES
  // =====================================================

  const [currentSong, setCurrentSong] =
    useState(null)

  const [videoReady, setVideoReady] =
    useState(false)

  const [showInfo, setShowInfo] =
    useState(false)

  // =====================================================
  // REFS
  // =====================================================

  const playerRef =
    useRef(null)

  const socketRef =
    useRef(null)

  const infoTimeoutRef =
    useRef(null)

  // =====================================================
  // WEBSOCKET
  // =====================================================

 useEffect(() => {

  const socket = new WebSocket(
    `${import.meta.env.VITE_WS_URL.replace("https", "wss")}/ws`
  )

  socketRef.current = socket

  // =========================
  // CONNECT
  // =========================
  socket.onopen = () => {
    console.log("TV SOCKET CONNECTED")
  }

  // =========================
  // MESSAGE
  // =========================
  socket.onmessage = async (event) => {

    try {

      const data = JSON.parse(event.data)

      if (data.type === "LOAD_VIDEO") {
        setVideoReady(false)
        setCurrentSong(data.song)
      }

      if (data.type === "STOP_VIDEO") {
        setCurrentSong(null)
        setVideoReady(false)
      }

    } catch (err) {
      console.log("WS PARSE ERROR", err)
    }
  }

  // =========================
  // ERROR
  // =========================
  socket.onerror = (err) => {
    console.log("TV SOCKET ERROR", err)
  }

  // =========================
  // CLOSE
  // =========================
  socket.onclose = () => {
    console.log("TV SOCKET CLOSED")
  }

  // =========================
  // CLEANUP
  // =========================
  return () => {
    socket.close()
  }

}, [])

  // =====================================================
  // PLAYER READY
  // =====================================================

  const handleReady = (
    event
  ) => {

    playerRef.current =
      event.target

    console.log(
      "PLAYER READY"
    )

  }

  // =====================================================
  // PLAYER STATE
  // =====================================================

  const handleStateChange =
    async (event) => {

      // =========================================
      // PLAYING
      // =========================================

      if (event.data === 1) {

        setVideoReady(true)

        setShowInfo(true)

        clearTimeout(
          infoTimeoutRef.current
        )

        infoTimeoutRef.current =
          setTimeout(() => {

            setShowInfo(false)

          }, 3500)

      }

      // =========================================
      // ENDED
      // =========================================

      if (event.data === 0) {

        try {

          playNextSong()

        } catch (err) {

          console.log(err)

        }

      }

    }

  // =====================================================
  // PLAYER ERROR
  // =====================================================

  const handleError =
    async (err) => {

      console.log(
        "PLAYER ERROR",
        err
      )

      try {

        playNextSong()

      } catch (e) {

        console.log(e)

      }

    }

  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {

    return () => {

      clearTimeout(
        infoTimeoutRef.current
      )

    }

  }, [])

  // =====================================================
  // YOUTUBE OPTIONS
  // =====================================================

  const opts = {

    width: "100%",

    height: "100%",

    playerVars: {

      autoplay: 1,

      controls: 0,

      modestbranding: 1,

      rel: 0,

      fs: 0,

      disablekb: 1,

      playsinline: 1,

      iv_load_policy: 3,

      cc_load_policy: 0,

      origin:
        window.location.origin,

    },

  }

  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="min-h-screen bg-black overflow-hidden relative text-white">

      {/* ==========================================
          PLAYER
      ========================================== */}

      {currentSong && (

        <div
          className={`
            absolute inset-0
            transition-opacity duration-300

            ${videoReady
              ? "opacity-100"
              : "opacity-0"}
          `}
        >

          <YouTube

            videoId={
              currentSong.youtubeId
            }

            opts={opts}

            onReady={
              handleReady
            }

            onStateChange={
              handleStateChange
            }

            onError={
              handleError
            }

            className="
              w-full
              h-full
            "

            iframeClassName="
              w-full
              h-full
              pointer-events-none
            "
          />

        </div>

      )}

      {/* ==========================================
          IDLE SCREEN
      ========================================== */}

      {!currentSong && (

        <div
          className="
            absolute
            inset-0
            flex
            flex-col
            items-center
            justify-center
            bg-black
          "
        >

          <div
            className="
              w-80
              h-80
              bg-white
              rounded-3xl
              flex
              items-center
              justify-center
              text-black
              text-6xl
              font-black
            "
          >
            QR
          </div>

          <h1
            className="
              text-6xl
              font-black
              mt-10
              text-cyan-400
            "
          >
            MKARAOKE
          </h1>

        </div>

      )}

      {/* ==========================================
          SONG INFO
      ========================================== */}

      {currentSong && (

        <div
          className={`
            absolute
            top-5
            left-5
            bg-black/70
            backdrop-blur-xl
            border
            border-cyan-500/20
            rounded-2xl
            px-5
            py-3
            shadow-2xl
            transition-all
            duration-300

            ${showInfo
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-5"}
          `}
        >

          <h2
            className="
              text-2xl
              font-black
            "
          >

            {currentSong.title}

          </h2>

          <p
            className="
              text-zinc-400
              mt-1
            "
          >

            {currentSong.artist}

          </p>

        </div>

      )}

      {/* ==========================================
          FLOATING QR
      ========================================== */}

      {currentSong && (

        <div
          className="
            absolute
            bottom-5
            right-5
            bg-zinc-900/90
            border
            border-zinc-700
            rounded-3xl
            p-4
            backdrop-blur-xl
            shadow-2xl
          "
        >

          <div
            className="
              w-32
              h-32
              rounded-2xl
              bg-white
              flex
              items-center
              justify-center
              text-black
              font-black
              text-2xl
            "
          >
            QR
          </div>

          <p
            className="
              text-center
              mt-3
              text-zinc-400
              text-sm
            "
          >

            Escanea para cantar

          </p>

        </div>

      )}

    </div>

  )

}

export default TvPage