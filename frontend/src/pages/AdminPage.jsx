import { useRef } from "react"
import Swal from "sweetalert2"
import { useKaraoke } from "../context/KaraokeContext"

function AdminPage() {

  const {
    queue,
    currentSong,
    playNextSong,
    playNow,
    removeSongById,
    addSong,
  } = useKaraoke()

  // =========================
  // DRAG STATE
  // =========================

  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  // =========================
  // AUDIO FX (OPTIMIZADO)
  // =========================

  let audioCtx = null

  const playSound = (freq = 400) => {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      }

      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()

      osc.connect(gain)
      gain.connect(audioCtx.destination)

      osc.frequency.value = freq
      osc.type = "square"

      gain.gain.setValueAtTime(0.05, audioCtx.currentTime)

      osc.start()
      osc.stop(audioCtx.currentTime + 0.12)

    } catch {}
  }

  // =========================
  // NEXT
  // =========================

  const handleNext = () => {
    playSound(180)
    playNextSong()
  }

  // =========================
  // PLAY NOW
  // =========================

  const handlePlayNow = (song) => {
    if (!song?.id) return
    playSound(700)
    playNow(song.id)
  }

  // =========================
  // REMOVE
  // =========================

  const handleRemove = async (song) => {
    const res = await Swal.fire({
      title: "Eliminar canción",
      text: song.title,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      background: "#111",
      color: "#fff",
    })

    if (!res.isConfirmed) return

    removeSongById(song.id)
    playSound(120)
  }

  // =========================
  // RESTART
  // =========================

  const handleRestartSong = () => {
    if (!currentSong) return
    playSound(500)
    playNow(currentSong.id)
  }

  // =========================
  // REPEAT
  // =========================

  const handleRepeat = (song) => {
    playSound(500)

    addSong({
      title: song.title,
      artist: song.artist,
      youtubeId: song.youtubeId,
      ownerId: song.ownerId || "system",
    })
  }

  // =========================
  // MOVE UP (REAL ORDER)
  // =========================

  const moveUp = (index) => {
    if (index === 0) return

    const newQueue = [...queue]

    const temp = newQueue[index - 1]
    newQueue[index - 1] = newQueue[index]
    newQueue[index] = temp

    reorderQueue(newQueue)
  }

  // =========================
  // MOVE DOWN (REAL ORDER)
  // =========================

  const moveDown = (index) => {
    if (index === queue.length - 1) return

    const newQueue = [...queue]

    const temp = newQueue[index + 1]
    newQueue[index + 1] = newQueue[index]
    newQueue[index] = temp

    reorderQueue(newQueue)
  }

  // =========================
  // REORDER (BACKEND READY)
  // =========================

  const reorderQueue = (newQueue) => {
    console.log("NEW ORDER:", newQueue.map(s => s.id))
    // aquí conectarás backend si tienes:
    // reorderQueueApi(newQueue.map(s => s.id))
  }

  // =========================
  // DRAG EVENTS
  // =========================

  const handleDragStart = (index) => {
    dragItem.current = index
  }

  const handleDragEnter = (index) => {
    dragOverItem.current = index
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = () => {
    if (dragItem.current == null || dragOverItem.current == null) return

    const from = dragItem.current
    const to = dragOverItem.current

    if (from === to) return

    const newQueue = [...queue]

    const movedItem = newQueue.splice(from, 1)[0]
    newQueue.splice(to, 0, movedItem)

    reorderQueue(newQueue)

    dragItem.current = null
    dragOverItem.current = null

    playSound(700)
  }

  // =========================
  // RENDER
  // =========================

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

      {/* CURRENT */}
      <div className="bg-zinc-900 border border-cyan-500 rounded-3xl p-6 mb-8">
        <p className="text-cyan-400 font-bold mb-3">
          🎤 REPRODUCIENDO AHORA
        </p>

        {currentSong ? (
          <div>
            <h2 className="text-3xl font-black">
              {currentSong.title}
            </h2>
            <p className="text-zinc-500">
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
        <button
          onClick={handleNext}
          className="bg-cyan-500 text-black px-6 py-3 rounded-2xl font-bold"
        >
          NEXT
        </button>

        <button
          onClick={handleRestartSong}
          className="bg-yellow-400 text-black px-6 py-3 rounded-2xl font-bold"
        >
          RESTART
        </button>
      </div>

      {/* QUEUE */}
      <div className="bg-zinc-900 rounded-3xl p-6">

        <h2 className="text-2xl font-black text-cyan-400 mb-6">
          Cola ({queue.length})
        </h2>

        {queue.length === 0 && (
          <p className="text-zinc-500">Cola vacía</p>
        )}

        {queue.map((song, index) => (
          <div
            key={song.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDrop}
            onDragOver={handleDragOver}
            className="bg-black border border-zinc-800 hover:border-cyan-500 rounded-2xl p-4 mb-4 flex justify-between items-center"
          >

            {/* INFO */}
            <div>
              <h3 className="font-bold">{song.title}</h3>
              <p className="text-zinc-500">{song.artist}</p>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-2">

              <button
                onClick={() => handlePlayNow(song)}
                className="bg-green-500 px-3 py-1 rounded"
              >
                ▶
              </button>

              <button
                onClick={() => {
                  playSound(600)
                  moveUp(index)
                }}
                className="bg-zinc-700 px-3 py-1 rounded"
              >
                ▲
              </button>

              <button
                onClick={() => {
                  playSound(600)
                  moveDown(index)
                }}
                className="bg-zinc-700 px-3 py-1 rounded"
              >
                ▼
              </button>

              <button
                onClick={() => handleRemove(song)}
                className="bg-red-500 px-3 py-1 rounded"
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