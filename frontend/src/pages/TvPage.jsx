import { useEffect, useRef, useState } from "react"
import YouTube from "react-youtube"
import { QRCodeCanvas } from "qrcode.react"

import { useKaraoke } from "../context/KaraokeContext"

function TvPage() {

  const { playNextSong } = useKaraoke()

  // =========================
  // STATES
  // =========================

  const [currentSong, setCurrentSong] = useState(null)
  const [videoReady, setVideoReady] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [qrUrl, setQrUrl] = useState("")
  const [playerKey, setPlayerKey] = useState(0)

  // =========================
  // REFS
  // =========================

  const playerRef = useRef(null)
  const socketRef = useRef(null)
  const infoTimeoutRef = useRef(null)
  const mountedRef = useRef(true)

  // =========================
  // QR URL (SAFE)
  // =========================

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        setQrUrl(window.location.origin || "")
      }
    } catch {
      setQrUrl("")
    }
  }, [])

  // =========================
  // WEBSOCKET (SAFE + CLEAN)
  // =========================

  useEffect(() => {

    mountedRef.current = true

    const wsUrl =
      import.meta.env.VITE_WS_URL?.replace("https", "wss")

    if (!wsUrl) return

    const socket = new WebSocket(`${wsUrl}/ws`)
    socketRef.current = socket

    socket.onopen = () => {
      console.log("TV SOCKET CONNECTED")
    }

    socket.onmessage = async (event) => {
      if (!mountedRef.current) return

      try {
        if (!event?.data) return

        const data = JSON.parse(event.data)

        if (data.type === "LOAD_VIDEO") {

          const song = data?.song
          if (!song?.youtubeId) return

          setVideoReady(false)

          setPlayerKey(prev => prev + 1)

          setCurrentSong(song)
        }

        if (data.type === "STOP_VIDEO") {

          setCurrentSong(null)
          setVideoReady(false)
          setPlayerKey(prev => prev + 1)
        }

      } catch (err) {
        console.log("WS PARSE ERROR", err)
      }
    }

    socket.onerror = (err) => {
      console.log("TV SOCKET ERROR", err)
    }

    socket.onclose = () => {
      console.log("TV SOCKET CLOSED")
    }

    return () => {
      mountedRef.current = false
      socket.close()
      socketRef.current = null
    }

  }, [])

  // =========================
  // PLAYER READY
  // =========================

  const handleReady = (event) => {
    playerRef.current = event.target
  }

  // =========================
  // STATE CHANGE
  // =========================

  const handleStateChange = async (event) => {

    if (!mountedRef.current) return

    // PLAYING
    if (event.data === 1) {

      setVideoReady(true)
      setShowInfo(true)

      clearTimeout(infoTimeoutRef.current)

      infoTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setShowInfo(false)
      }, 3500)
    }

    // ENDED
    if (event.data === 0) {
      try {
        await playNextSong()
      } catch (err) {
        console.log(err)
      }
    }
  }

  // =========================
  // ERROR HANDLER SAFE
  // =========================

  const handleError = async (err) => {
    console.log("PLAYER ERROR", err)

    try {
      await playNextSong()
    } catch (e) {
      console.log(e)
    }
  }

  // =========================
  // CLEANUP TIMEOUT
  // =========================

  useEffect(() => {
    return () => {
      clearTimeout(infoTimeoutRef.current)
    }
  }, [])

  // =========================
  // YOUTUBE OPTIONS (SAFE ORIGIN)
  // =========================

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
        typeof window !== "undefined"
          ? window.location.origin
          : ""
    },
  }

  // =========================
  // RENDER (NO CSS CHANGES)
  // =========================

  return (
    <div className="min-h-screen bg-black overflow-hidden relative text-white">

      {/* PLAYER */}
      {currentSong?.youtubeId && (

        <div
          className={`
            absolute inset-0
            transition-opacity duration-300
            ${videoReady ? "opacity-100" : "opacity-0"}
          `}
        >

          <YouTube
            key={playerKey}
            videoId={currentSong.youtubeId}
            opts={opts}
            onReady={handleReady}
            onStateChange={handleStateChange}
            onError={handleError}
            className="w-full h-full"
            iframeClassName="w-full h-full pointer-events-none"
          />

        </div>

      )}

      {/* IDLE SCREEN */}
      {!currentSong && (

        <div className="
          absolute inset-0
          flex flex-col items-center justify-center
          bg-gradient-to-br from-black via-zinc-950 to-cyan-950
          overflow-hidden
        ">

          <div className="
            absolute w-[700px] h-[700px]
            bg-cyan-500/10 blur-3xl rounded-full
          " />

          <div className="relative z-10 flex flex-col items-center">

            <h1 className="
              text-7xl font-black tracking-tight text-white drop-shadow-2xl
            ">
              M<span className="text-cyan-400">KARAOKE</span>
            </h1>

            <p className="text-zinc-400 text-xl mt-3 mb-10 font-medium">
              Escanea y agrega tu canción
            </p>

            <div className="
              relative bg-white rounded-[2.5rem] p-7
              shadow-[0_0_80px_rgba(34,211,238,0.25)]
              border border-white/40
            ">
              {qrUrl && (
                <QRCodeCanvas
                  value={qrUrl}
                  size={320}
                />
              )}
            </div>

            <div className="
              mt-8 px-6 py-3 rounded-2xl
              bg-cyan-500/10 border border-cyan-400/20
              backdrop-blur-xl
            ">
              <p className="text-cyan-300 text-lg font-semibold tracking-wide">
                Escanea para cantar
              </p>
            </div>

          </div>
        </div>
      )}

      {/* SONG INFO */}
      {currentSong && (

        <div className={`
          absolute top-5 left-5
          bg-black/70 backdrop-blur-xl
          border border-cyan-500/20
          rounded-2xl px-5 py-3
          shadow-2xl transition-all duration-300
          ${showInfo ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-5"}
        `}>

          <h2 className="text-2xl font-black">
            {currentSong.title}
          </h2>

          <p className="text-zinc-400 mt-1">
            {currentSong.artist}
          </p>

        </div>

      )}

      {/* FLOATING QR */}
      {currentSong && (

        <div className="
          absolute bottom-5 right-5
          bg-black/70 border border-cyan-500/20
          rounded-3xl p-4 backdrop-blur-2xl
          shadow-2xl
        ">

          <div className="bg-white rounded-2xl p-2">

            {qrUrl && (
              <QRCodeCanvas
                value={qrUrl}
                size={120}
              />
            )}

          </div>

          <p className="text-center mt-3 text-cyan-300 text-sm font-semibold">
            Escanea para cantar
          </p>

        </div>

      )}

    </div>
  )
}

export default TvPage