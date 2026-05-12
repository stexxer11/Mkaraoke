import { useState, useEffect, useRef, useMemo } from "react"
import debounce from "lodash.debounce"

import { useKaraoke } from "../context/KaraokeContext"

import Swal from "sweetalert2"

import { searchYouTube } from "../services/youtubeApi"

function MobilePage() {

  const {
    queue,
    addSong,
    editSong,
    deviceId,
    currentSong,
  } = useKaraoke()

  // =====================================================
  // STATES
  // =====================================================

  const [search, setSearch] =
    useState("")

  const [results, setResults] =
    useState([])

  const [loading, setLoading] =
    useState(false)

  const [editMode, setEditMode] =
    useState(false)

  const [editSongData, setEditSongData] =
    useState(null)

  // =====================================================
  // ALERT CONTROL
  // =====================================================

  const alertOpen =
    useRef(null)

  const lastQueueRef =
    useRef("")

  // =====================================================
  // SEARCH
  // =====================================================

  const debouncedSearch =
    useMemo(

      () => debounce(

        async (value) => {

          if (
            !value ||
            value.trim().length < 3
          ) {

            setResults([])

            return

          }

          setLoading(true)

          try {

            const data =
              await searchYouTube(value)

            setResults(data || [])

          } catch (err) {

            console.log(err)

            setResults([])

          }

          setLoading(false)

        },

        600

      ),

      []

    )

  const handleSearch = (
    value
  ) => {

    setSearch(value)

    debouncedSearch(value)

  }

  useEffect(() => {

    return () => {

      debouncedSearch.cancel()

    }

  }, [debouncedSearch])

  // =====================================================
  // MULTI USER SAFE
  // =====================================================

  const mySongs =
    useMemo(() => {

      return queue.filter(

        song =>

          String(song.ownerId) ===
          String(deviceId)

      )

    }, [

      queue,
      deviceId

    ])

  // =====================================================
  // MY CURRENT SONG
  // =====================================================

  const myCurrentSong =
    useMemo(() => {

      return mySongs.find(

        s =>
          s.status === "playing"

      )

    }, [mySongs])

  // =====================================================
  // UPCOMING SONGS
  // =====================================================

  const myQueuedSongs =
    useMemo(() => {

      return mySongs.filter(

        s =>
          s.status === "queued"

      )

    }, [mySongs])

  // =====================================================
  // QUEUE POSITION
  // =====================================================

  const turnsLeft =
    useMemo(() => {

      if (!currentSong) return 0

      const activeQueue =
        queue.filter(

          s =>

            s.status ===
              "queued" ||

            s.status ===
              "playing"

        )

      const myNextSong =
        myQueuedSongs[0]

      if (!myNextSong)
        return 0

      const currentIndex =
        activeQueue.findIndex(
          s =>
            s.id === currentSong.id
        )

      const myIndex =
        activeQueue.findIndex(
          s =>
            s.id === myNextSong.id
        )

      if (
        currentIndex === -1 ||
        myIndex === -1
      ) {
        return 0
      }

      return Math.max(
        myIndex - currentIndex,
        0
      )

    }, [

      queue,
      currentSong,
      myQueuedSongs

    ])

  // =====================================================
  // ALERT SYSTEM
  // =====================================================

  useEffect(() => {

    const queueHash =
      JSON.stringify(

        queue.map(s => ({
          id: s.id,
          status: s.status
        }))

      )

    if (
      queueHash ===
      lastQueueRef.current
    ) {
      return
    }

    lastQueueRef.current =
      queueHash

    // =========================================
    // RESET
    // =========================================

    if (!currentSong) {

      alertOpen.current = null

      if (Swal.isVisible()) {
        Swal.close()
      }

      return

    }

    // =========================================
    // PREVENT DUPLICATE
    // =========================================

    const alertId =
      `${currentSong.id}-${deviceId}`

    if (
      alertOpen.current ===
      alertId
    ) {
      return
    }

    alertOpen.current =
      alertId

    // =========================================
    // 1. MY SONG PLAYING
    // =========================================

    if (myCurrentSong) {

      Swal.fire({

        title:
          "Disfruta tu canción 🎤",

        html: `
          <div style="font-size:16px;text-align:center">

            <b style="font-size:18px">
              ${myCurrentSong.title}
            </b>

            <br/>

            <span style="color:#22d3ee">
              Estás en pantalla ahora
            </span>

          </div>
        `,

        background: "#000",

        color: "#06b6d4",

        showConfirmButton: false,

        allowOutsideClick: false,

        allowEscapeKey: false

      })

      return

    }

    // =========================================
    // 2. I HAVE SONGS IN QUEUE
    // =========================================

    if (myQueuedSongs.length > 0) {

      Swal.fire({

        title:
          "Tu canción está en cola",

        html: `
          <div style="font-size:16px;text-align:center">

            <b>
              ${myQueuedSongs[0].title}
            </b>

            <br/>

            <span style="color:#9ca3af">

              ${
                turnsLeft <= 1
                  ? "Tu turno viene pronto"
                  : `Te faltan ${turnsLeft} turnos`
              }

            </span>

          </div>
        `,

        background: "#000",

        color: "#06b6d4",

        showConfirmButton: false,

        allowOutsideClick: false,

        allowEscapeKey: false

      })

      return

    }

    // =========================================
    // 3. READY TO EDIT
    // =========================================

    if (
      currentSong &&
      currentSong.ownerId === deviceId
    ) {

      Swal.fire({

        title:
          "Tu turno está activo 🎤",

        html: `
          <div style="font-size:16px;text-align:center">

            <b style="font-size:18px">
              ${currentSong.title}
            </b>

            <br/>

            <span style="color:#22d3ee">
              Puedes prepararte
            </span>

          </div>
        `,

        background: "#000",

        color: "#06b6d4",

        showDenyButton: true,

        denyButtonText:
          "Editar canción",

        showConfirmButton: false,

        allowOutsideClick: false,

        allowEscapeKey: false

      }).then(res => {

        if (res.isDenied) {

          setEditMode(true)

          setEditSongData(
            currentSong
          )

          setSearch("")

          setResults([])

          alertOpen.current = null

        }

      })

    }

  }, [

    queue,
    currentSong,
    deviceId,
    myCurrentSong,
    myQueuedSongs,
    turnsLeft

  ])

  // =====================================================
  // ADD SONG
  // =====================================================

  const handleAddSong =
    async (song) => {

      if (mySongs.length > 0) {

        Swal.fire({

          icon: "warning",

          title:
            "Ya tienes una canción en cola",

          toast: true,

          timer: 2000,

          position: "top-end",

          showConfirmButton: false

        })

        return

      }

      const res =
        await addSong({

          title:
            song.title,

          artist:
            song.artist,

          youtubeId:
            song.youtubeId,

        })

      if (res?.ok) {

        Swal.fire({

          icon: "success",

          title:
            "Canción agregada",

          toast: true,

          timer: 1500,

          position: "top-end",

          showConfirmButton: false

        })

      }

    }

  // =====================================================
  // REPLACE SONG
  // =====================================================

  const handleReplaceSong =
    async (song) => {

      if (!editSongData)
        return

      const res =
        await editSong(

          editSongData.id,

          {
            title:
              song.title,

            artist:
              song.artist,

            youtubeId:
              song.youtubeId
          }

        )

      if (res?.ok) {

        setEditMode(false)

        setEditSongData(null)

        setSearch("")

        setResults([])

        Swal.fire({

          icon: "success",

          title:
            "Canción actualizada",

          toast: true,

          timer: 1500,

          position: "top-end",

          showConfirmButton: false

        })

      }

    }

  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div
      className="
        min-h-screen
        bg-black
        text-white
        flex
        flex-col
      "
    >

      {/* =========================================
          HEADER
      ========================================= */}

      <div
        className="
          p-5
          border-b
          border-white/10
          bg-zinc-950
          backdrop-blur-xl
        "
      >

        <h1
          className="
            text-3xl
            font-black
            text-cyan-400
          "
        >
          MKaraoke
        </h1>

        <p
          className="
            text-zinc-400
            mt-1
          "
        >
          Busca tu canción en YouTube
        </p>

      </div>

      {/* =========================================
          SEARCH
      ========================================= */}

      <div className="p-5">

        <input

          className="
            w-full
            p-4
            rounded-2xl
            bg-zinc-900
            border
            border-white/10
            outline-none
          "

          placeholder={
            editMode
              ? "Buscar reemplazo..."
              : "Buscar en YouTube..."
          }

          value={search}

          onChange={(e) =>
            handleSearch(
              e.target.value
            )
          }

        />

      </div>

      {/* =========================================
          RESULTS
      ========================================= */}

      <div
        className="
          flex-1
          overflow-y-auto
          p-5
          space-y-4
        "
      >

        {loading && (

          <p className="text-zinc-500">
            Buscando en YouTube...
          </p>

        )}

        {results.map(song => (

          <div

            key={song.youtubeId}

            className="
              bg-zinc-950
              border
              border-white/10
              rounded-3xl
              p-3
              flex
              gap-4
              items-center
            "
          >

            <div
              className="
                w-20
                h-20
                rounded-2xl
                overflow-hidden
                shrink-0
              "
            >

              <img

                src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}

                className="
                  w-full
                  h-full
                  object-cover
                "

              />

            </div>

            <div className="flex-1 min-w-0">

              <p
                className="
                  font-bold
                  truncate
                "
              >
                {song.title}
              </p>

              <p
                className="
                  text-zinc-400
                  text-sm
                  truncate
                "
              >
                {song.artist}
              </p>

            </div>

            <button

              onClick={() =>

                editMode
                  ? handleReplaceSong(song)
                  : handleAddSong(song)

              }

              className="
                bg-cyan-400
                text-black
                px-5
                py-3
                rounded-2xl
                font-black
              "
            >
              +
            </button>

          </div>

        ))}

      </div>

      {/* =========================================
          FOOTER
      ========================================= */}

      <div
        className="
          p-4
          border-t
          border-white/10
          text-center
          text-zinc-400
          bg-zinc-950
        "
      >

        Cola global:
        {" "}
        {queue.length}

      </div>

    </div>

  )

}

export default MobilePage