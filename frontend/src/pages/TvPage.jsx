import { useEffect, useRef, useState } from "react"
import YouTube from "react-youtube"
import { QRCodeCanvas } from "qrcode.react"
import { useKaraoke } from "../context/KaraokeContext"

function TvPage() {

  const { playNextSong } = useKaraoke()

  // =========================
  // STATE
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

  // =========================
  // SAFE ORIGIN
  // =========================

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : ""

  // =========================
  // QR INIT
  // =========================

  useEffect(() => {
    if (origin) setQrUrl(origin)
  }, [origin])

  // =========================
  // SOCKET
  // =========================

  useEffect(() => {

    const wsUrl =
      import.meta.env.VITE_WS_URL
        ? import.meta.env.VITE_WS_URL.replace("https", "wss")
        : null

    if (!wsUrl) {
      console.error("VITE_WS_URL no definido")
      return
    }

    const socket = new WebSocket(`${wsUrl}/ws`)
    socketRef.current = socket

    socket.onopen = () => {
      console.log("TV SOCKET CONNECTED")
    }

    socket.onmessage = async (event) => {

      try {
        const data = JSON.parse(event.data)

        // =====================
        // LOAD VIDEO
        // =====================

        if (data.type === "LOAD_VIDEO") {

          clearTimeout(infoTimeoutRef.current)

          setVideoReady(false)
          setShowInfo(false)
          setCurrentSong(null)

          setPlayerKey(prev => prev + 1)

          // pequeño delay evita glitch YouTube reload
          setTimeout(() => {
            setCurrentSong(data.song)
          }, 50)
        }

        // =====================
        // STOP VIDEO
        // =====================

        if (data.type === "STOP_VIDEO") {

          clearTimeout(infoTimeoutRef.current)

          setVideoReady(false)
          setShowInfo(false)
          setCurrentSong(null)

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

    return () => socket.close()

  }, [])

  // =========================
  // PLAYER EVENTS
  // =========================

  const handleReady = (event) => {
    playerRef.current = event.target
  }

  const handleStateChange = async (event) => {

    if (event.data === 1) {

      setVideoReady(true)
      setShowInfo(true)

      clearTimeout(infoTimeoutRef.current)

      infoTimeoutRef.current = setTimeout(() => {
        setShowInfo(false)
      }, 3500)
    }

    if (event.data === 0) {
      try {
        await playNextSong()
      } catch (err) {
        console.log(err)
      }
    }
  }

  const handleError = async (err) => {
    console.log("PLAYER ERROR", err)

    try {
      await playNextSong()
    } catch (e) {
      console.log(e)
    }
  }

  // =========================
  // CLEANUP
  // =========================

  useEffect(() => {
    return () => {
      clearTimeout(infoTimeoutRef.current)
    }
  }, [])

  // =========================
  // YOUTUBE OPTIONS
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
      origin,
    },
  }

  // =========================
  // RENDER
  // =========================

  return (
    <div className="min-h-screen bg-black overflow-hidden relative text-white">

      {/* PLAYER */}
      {currentSong && (
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
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

      {/* IDLE */}
      {!currentSong && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black via-zinc-950 to-cyan-950">

          <div className="absolute w-[700px] h-[700px] bg-cyan-500/10 blur-3xl rounded-full" />

          <div className="relative z-10 flex flex-col items-center">

            <h1 className="text-7xl font-black text-white">
              M<span className="text-cyan-400">KARAOKE</span>
            </h1>

            <p className="text-zinc-400 mt-3 mb-10">
              Escanea y agrega tu canción
            </p>

            <div className="bg-white p-7 rounded-[2.5rem]">
              {qrUrl && (
                <QRCodeCanvas value={qrUrl} size={320} />
              )}
            </div>

          </div>
        </div>
      )}

      {/* INFO */}
      {currentSong && (
        <div className={`absolute top-5 left-5 bg-black/70 px-5 py-3 rounded-2xl transition ${
          showInfo ? "opacity-100" : "opacity-0"
        }`}>
          <h2 className="text-2xl font-black">
            {currentSong.title}
          </h2>
          <p className="text-zinc-400">
            {currentSong.artist}
          </p>
        </div>
      )}

      {/* QR MINI */}
      {currentSong && (
        <div className="absolute bottom-5 right-5 bg-black/70 p-4 rounded-3xl">
          <QRCodeCanvas value={qrUrl} size={120} />
        </div>
      )}

    </div>
  )
}

export default TvPage