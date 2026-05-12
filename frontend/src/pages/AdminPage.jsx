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
    repeatSong,
    reorderQueue: reorderQueueAction,
    restartSong,
  } = useKaraoke()

  // =====================================================
  // DRAG STATE
  // =====================================================

  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  // =====================================================
  // ACTIONS
  // =====================================================

  const handleNext = () => {
    playNextSong()
  }

  const handlePlayNow = (song) => {

    if (!song?.id) return

    playNow(song.id)
  }

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

    await removeSongById(song.id)
  }

  const handleRestartSong = async () => {

    if (!currentSong) return

    await restartSong(currentSong.id)
  }

  const handleRepeat = async (song) => {
    await repeatSong(song)
  }

  // =====================================================
  // REAL REORDER (DB + WS)
  // =====================================================

  const reorderQueue = async (newQueue) => {

    try {

      await reorderQueueAction(newQueue)

    } catch (err) {
      console.log(err)
    }
  }

  const moveUp = async (index) => {

    if (index === 0) return

    const newQueue = [...queue]

    ;[newQueue[index - 1], newQueue[index]] =
      [newQueue[index], newQueue[index - 1]]

    await reorderQueue(newQueue)
  }

  const moveDown = async (index) => {

    if (index === queue.length - 1) return

    const newQueue = [...queue]

    ;[newQueue[index + 1], newQueue[index]] =
      [newQueue[index], newQueue[index + 1]]

    await reorderQueue(newQueue)
  }

  // =====================================================
  // DRAG EVENTS
  // =====================================================

  const handleDragStart = (index) => {
    dragItem.current = index
  }

  const handleDragEnter = (index) => {
    dragOverItem.current = index
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = async () => {

    const from = dragItem.current
    const to = dragOverItem.current

    if (from == null || to == null || from === to) return

    const newQueue = [...queue]

    const moved = newQueue.splice(from, 1)[0]

    newQueue.splice(to, 0, moved)

    await reorderQueue(newQueue)

    dragItem.current = null
    dragOverItem.current = null
  }

  // =====================================================
  // RENDER
  // =====================================================

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
          REPRODUCIENDO AHORA
        </p>

        {currentSong ? (
          <>

            <h2 className="text-3xl font-black">
              {currentSong.title}
            </h2>

            <p className="text-zinc-500">
              {currentSong.artist}
            </p>

          </>
        ) : (
          <p className="text-zinc-500">
            Esperando canciones...
          </p>
        )}

      </div>

      {/* ACTIONS */}
      <div className="flex flex-wrap gap-4 mb-8">

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
          <p className="text-zinc-500">
            Cola vacía
          </p>
        )}

        {queue.map((song, index) => (

          <div
            key={song.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragOver={handleDragOver}
            onDragEnd={handleDrop}
            className="bg-black border border-zinc-800 hover:border-cyan-500 rounded-2xl p-4 mb-4 flex justify-between items-center"
          >

            {/* INFO */}
            <div>

              <h3 className="font-bold">
                {song.title}
              </h3>

              <p className="text-zinc-500">
                {song.artist}
              </p>

            </div>

            {/* ACTIONS */}
            <div className="flex flex-wrap gap-2">

              <button
                onClick={() => handlePlayNow(song)}
                className="bg-green-500 px-3 py-1 rounded font-bold"
              >
                PLAY NOW
              </button>

              <button
                onClick={() => moveUp(index)}
                className="bg-zinc-700 px-3 py-1 rounded font-bold"
              >
                UP
              </button>

              <button
                onClick={() => moveDown(index)}
                className="bg-zinc-700 px-3 py-1 rounded font-bold"
              >
                DOWN
              </button>

              <button
                onClick={() => handleRepeat(song)}
                className="bg-purple-500 px-3 py-1 rounded font-bold"
              >
                REPEAT
              </button>

              <button
                onClick={() => handleRemove(song)}
                className="bg-red-500 px-3 py-1 rounded font-bold"
              >
                DELETE
              </button>

            </div>

          </div>

        ))}

      </div>

    </div>
  )
}

export default AdminPage