import { useRef } from "react"
import Swal from "sweetalert2"

import {
  useKaraoke,
} from "../context/KaraokeContext"

function AdminPage() {

  const {

    queue,
    currentSong,

    playNextSong,
    playNow,

    removeSongById,

    moveSongUp,
    moveSongDown,

    addSong,

  } = useKaraoke()

  // ====================================
  // DRAG SYSTEM
  // ====================================

  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  // ====================================
  // DJ SOUND FX
  // ====================================

  const playSound = (
    freq = 400
  ) => {

    try {

      const ctx =
        new (
          window.AudioContext ||
          window.webkitAudioContext
        )()

      const osc =
        ctx.createOscillator()

      const gain =
        ctx.createGain()

      osc.connect(gain)

      gain.connect(
        ctx.destination
      )

      osc.frequency.value =
        freq

      osc.type =
        "square"

      gain.gain.setValueAtTime(
        0.05,
        ctx.currentTime
      )

      osc.start()

      osc.stop(
        ctx.currentTime + 0.12
      )

    } catch {}

  }

  // ====================================
  // NEXT SONG
  // INSTANT
  // ====================================

  const handleNext = () => {

    playSound(180)

    playNextSong()

  }

  // ====================================
  // PLAY NOW
  // INSTANT
  // ====================================

  const handlePlayNow =
    (song) => {

      playSound(700)

      playNow(
        song.id
      )

    }

  // ====================================
  // REMOVE SONG
  // KEEP CONFIRMATION
  // ====================================

  const handleRemove =
    async (song) => {

      const res =
        await Swal.fire({

          title:
            "Eliminar canción",

          text:
            song.title,

          icon: "warning",

          showCancelButton: true,

          confirmButtonText:
            "Eliminar",

          background: "#111",

          color: "#fff",
        })

      if (
        !res.isConfirmed
      ) return

      removeSongById(
        song.id
      )

      playSound(120)

    }

  // ====================================
  // RESTART CURRENT SONG
  // INSTANT
  // ====================================

  const handleRestartSong =
    () => {

      if (!currentSong)
        return

      playSound(500)

      playNow(
        currentSong.id
      )

    }

  // ====================================
  // REPEAT SONG
  // INSTANT
  // ====================================

  const handleRepeat =
    (song) => {

      playSound(500)

      addSong({

        title:
          song.title,

        artist:
          song.artist,

        youtubeId:
          song.youtubeId,
      })

    }

  // ====================================
  // DRAG START
  // ====================================

  const handleDragStart =
    (index) => {

      dragItem.current =
        index

    }

  // ====================================
  // DRAG ENTER
  // ====================================

  const handleDragEnter =
    (index) => {

      dragOverItem.current =
        index

    }

  // ====================================
  // DROP
  // ====================================

  const handleDrop = () => {

    if (

      dragItem.current ===
        null ||

      dragOverItem.current ===
        null

    ) {
      return
    }

    const from =
      dragItem.current

    const to =
      dragOverItem.current

    if (from === to)
      return

    if (from < to) {

      moveSongDown(
        queue[from].id
      )

    } else {

      moveSongUp(
        queue[from].id
      )

    }

    dragItem.current =
      null

    dragOverItem.current =
      null

    playSound(700)

  }

  return (

    <div className="min-h-screen bg-black text-white p-6">

      {/* HEADER */}
      <div className="mb-8">

        <h1 className="text-5xl font-black text-cyan-400">
          MKARAOKE ADMIN
        </h1>

        <p className="text-zinc-500 mt-2">
          Control profesional de cola
        </p>

      </div>

      {/* CURRENT SONG */}
      <div className="bg-zinc-900 border border-cyan-500 rounded-3xl p-6 mb-8">

        <p className="text-cyan-400 font-bold mb-3">
          🎤 REPRODUCIENDO AHORA
        </p>

        {currentSong ? (

          <div>

            <h2 className="text-3xl font-black">
              {currentSong.title}
            </h2>

            <p className="text-zinc-500 text-lg mt-1">
              {currentSong.artist}
            </p>

          </div>

        ) : (

          <p className="text-zinc-500">
            Esperando canciones...
          </p>

        )}

      </div>

      {/* ACTIONS */}
      <div className="flex gap-4 mb-8">

        {/* NEXT */}
        <button
          onClick={handleNext}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-3 rounded-2xl"
        >
          ⏭ NEXT
        </button>

        {/* RESTART */}
        <button
          onClick={
            handleRestartSong
          }
          className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-6 py-3 rounded-2xl"
        >
          ↺ RESTART
        </button>

      </div>

      {/* QUEUE */}
      <div className="bg-zinc-900 rounded-3xl p-6">

        <h2 className="text-2xl font-black text-cyan-400 mb-6">

          Cola ({queue.length})

        </h2>

        {queue.length === 0 && (

          <p className="text-zinc-500">
            Cola vacía
          </p>

        )}

        {queue.map((
          song,
          index
        ) => (

          <div
            key={song.id}

            draggable

            onDragStart={() =>
              handleDragStart(
                index
              )
            }

            onDragEnter={() =>
              handleDragEnter(
                index
              )
            }

            onDragEnd={
              handleDrop
            }

            className="bg-black border border-zinc-800 hover:border-cyan-500 rounded-2xl p-4 mb-4 transition flex justify-between items-center"
          >

            {/* INFO */}
            <div className="flex items-center gap-4">

              <div className="bg-cyan-500 text-black font-black w-12 h-12 rounded-full flex items-center justify-center">

                {index + 1}

              </div>

              <div>

                <h3 className="font-bold text-lg">
                  {song.title}
                </h3>

                <p className="text-zinc-500">
                  {song.artist}
                </p>

                <p className="text-xs text-cyan-400 mt-1">

                  {song.status}

                </p>

              </div>

            </div>

            {/* ACTIONS */}
            <div className="flex items-center gap-3">

              {/* PLAY NOW */}
              <button
                onClick={() =>
                  handlePlayNow(
                    song
                  )
                }
                className="bg-green-500 hover:bg-green-400 text-black px-3 py-2 rounded-xl font-bold"
              >
                ▶
              </button>

       

              {/* UP */}
              <button
                onClick={() => {

                  playSound(600)

                  moveSongUp(
                    song.id
                  )

                }}
                className="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl"
              >
                ▲
              </button>

              {/* DOWN */}
              <button
                onClick={() => {

                  playSound(600)

                  moveSongDown(
                    song.id
                  )

                }}
                className="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl"
              >
                ▼
              </button>

              {/* DELETE */}
              <button
                onClick={() =>
                  handleRemove(
                    song
                  )
                }
                className="bg-red-500 hover:bg-red-400 px-3 py-2 rounded-xl"
              >
                ✕
              </button>

            </div>

          </div>

        ))}

      </div>

    </div>

  )

}

export default AdminPage