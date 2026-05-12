import {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react"

import debounce from "lodash.debounce"

import Swal from "sweetalert2"

import {
  useKaraoke
} from "../context/KaraokeContext"

import {
  searchYouTube
} from "../services/youtubeApi"

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
  // REFS
  // =====================================================

  const alertOpen =
    useRef(null)

  const wsRef =
    useRef(null)

  // =====================================================
  // WEBSOCKET
  // =====================================================

  useEffect(() => {

    const ws = new WebSocket(
      `${import.meta.env.VITE_WS_URL.replace(
        "https",
        "wss"
      )}/ws`
    )

    wsRef.current = ws

    ws.onopen = () => {

      console.log(
        "MOBILE WS CONNECTED"
      )

    }

    ws.onmessage = (event) => {

      try {

        const data =
          JSON.parse(
            event.data
          )

        // =====================================
        // SONG STARTED
        // =====================================

        if (
          data.type ===
          "LOAD_VIDEO"
        ) {

          console.log(
            "SONG PLAYING",
            data.song?.title
          )

        }

        // =====================================
        // QUEUE UPDATE
        // =====================================

        if (
          data.type ===
          "queue_update"
        ) {

          console.log(
            "QUEUE UPDATED"
          )

        }

      } catch (err) {

        console.log(
          "WS PARSE ERROR",
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

    }

    return () => {

      ws.close()

    }

  }, [])

  // =====================================================
  // SEARCH
  // =====================================================

  const debouncedSearch =
    useMemo(

      () =>

        debounce(

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
                await searchYouTube(
                  value
                )

              setResults(
                data || []
              )

            } catch (err) {

              console.log(err)

              setResults([])

            }

            setLoading(false)

          },

          700

        ),

      []

    )

  // =====================================================
  // SEARCH INPUT
  // =====================================================

  const handleSearch = (
    value
  ) => {

    setSearch(value)

    debouncedSearch(value)

  }

  // =====================================================
  // CLEANUP SEARCH
  // =====================================================

  useEffect(() => {

    return () => {

      debouncedSearch.cancel()

    }

  }, [debouncedSearch])

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
  // MY CURRENT SONG
  // =====================================================

  const myCurrentSong =
    useMemo(() => {

      return mySongs[0] || null

    }, [mySongs])

  // =====================================================
  // POSITION IN QUEUE
  // =====================================================

  const myQueueIndex =
    useMemo(() => {

      if (!myCurrentSong)
        return -1

      return activeQueue.findIndex(

        song =>

          song.id ===
          myCurrentSong.id

      )

    }, [

      activeQueue,
      myCurrentSong

    ])

  // =====================================================
  // TURN SYSTEM
  // =====================================================

  const turnsLeft =

    myQueueIndex <= 0
      ? 0
      : myQueueIndex

  const isMyTurn =
    myQueueIndex !== -1

  const isMySongPlaying =

    currentSong?.id ===
    myCurrentSong?.id

  // =====================================================
  // ALERT SYSTEM
  // =====================================================

  useEffect(() => {

    // =========================================
    // NO SONG
    // =========================================

    if (!myCurrentSong) {

      alertOpen.current = null

      if (Swal.isVisible()) {

        Swal.close()

      }

      return

    }

    // =========================================
    // UNIQUE ALERT KEY
    // =========================================

    const uniqueKey =

      `${currentSong?.id}-${myCurrentSong?.id}`

    if (

      alertOpen.current ===
      uniqueKey

    ) {
      return
    }

    alertOpen.current =
      uniqueKey

    // =========================================
    // MY SONG PLAYING
    // =========================================

    if (isMySongPlaying) {

      Swal.fire({

        title:
          "Tu canción está sonando",

        html: `

          <div style="text-align:center">

            <b style="font-size:18px">

              ${myCurrentSong.title}

            </b>

            <br/>

            <span style="color:#22d3ee">

              Ya estás en pantalla

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
    // WAITING ALERT
    // =========================================

    Swal.fire({

      title:
        "Tu canción está en cola",

      html: `

        <div style="text-align:center">

          <b>

            ${myCurrentSong.title}

          </b>

          <br/>

          <span style="color:#9ca3af">

            ${

              turnsLeft === 0

                ? "Prepárate"

                : `Faltan ${turnsLeft} turnos`

            }

          </span>

        </div>

      `,

      background: "#000",

      color: "#06b6d4",

      showDenyButton:
        turnsLeft <= 1,

      denyButtonText:
        "Editar canción",

      showConfirmButton: false,

      allowOutsideClick: false,

      allowEscapeKey: false

    }).then(res => {

      if (res.isDenied) {

        setEditMode(true)

        setEditSongData(
          myCurrentSong
        )

        setSearch("")

        setResults([])

        alertOpen.current =
          null

      }

    })

  }, [

    currentSong,
    myCurrentSong,
    turnsLeft,
    isMySongPlaying

  ])

  // =====================================================
  // ADD SONG
  // =====================================================

  const handleAddSong =
    async (song) => {

      // =====================================
      // ONLY 1 SONG PER USER
      // =====================================

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

      // =====================================
      // ADD
      // =====================================

      const res =
        await addSong({

          title:
            song.title,

          artist:
            song.artist,

          youtubeId:
            song.youtubeId,

        })

      // =====================================
      // ERROR
      // =====================================

      if (!res?.ok) {

        Swal.fire({

          icon: "error",

          title:
            res?.error ||

            "No se pudo agregar",

          toast: true,

          timer: 2000,

          position: "top-end",

          showConfirmButton: false

        })

        return

      }

      // =====================================
      // SUCCESS
      // =====================================

      Swal.fire({

        icon: "success",

        title:
          "Canción agregada",

        toast: true,

        timer: 1500,

        position: "top-end",

        showConfirmButton: false

      })

      setSearch("")

      setResults([])

    }

  // =====================================================
  // EDIT SONG
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

      if (!res?.ok) {

        Swal.fire({

          icon: "error",

          title:
            "No se pudo actualizar",

          toast: true,

          timer: 2000,

          position: "top-end",

          showConfirmButton: false

        })

        return

      }

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

  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="min-h-screen text-white flex flex-col bg-black">

      {/* =========================================
          HEADER
      ========================================= */}

      <div
        className="
          p-5
          glass
          border-b
          border-white/10
        "
      >

        <h1
          className="
            text-3xl
            font-black
            text-cyan-400
            glow-cyan
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
            glass
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
          MY STATUS
      ========================================= */}

      {myCurrentSong && (

        <div className="px-5 pb-3">

          <div
            className="
              bg-cyan-500/10
              border
              border-cyan-400/20
              rounded-2xl
              p-4
            "
          >

            <p
              className="
                text-cyan-300
                text-sm
                mb-1
              "
            >
              Tu canción
            </p>

            <h2
              className="
                font-bold
                text-lg
                truncate
              "
            >
              {myCurrentSong.title}
            </h2>

            <p
              className="
                text-zinc-400
                text-sm
                truncate
              "
            >
              {myCurrentSong.artist}
            </p>

            <div className="mt-3">

              {isMySongPlaying ? (

                <span
                  className="
                    text-green-400
                    text-sm
                    font-bold
                  "
                >
                  SONANDO AHORA
                </span>

              ) : (

                <span
                  className="
                    text-cyan-300
                    text-sm
                    font-bold
                  "
                >
                  Faltan {turnsLeft} turnos
                </span>

              )}

            </div>

          </div>

        </div>

      )}

      {/* =========================================
          RESULTS
      ========================================= */}

      <div
        className="
          flex-1
          p-5
          space-y-4
          overflow-y-auto
        "
      >

        {loading && (

          <p className="text-zinc-500">

            Buscando...

          </p>

        )}

        {results.map(song => (

          <div

            key={song.youtubeId}

            className="
              glass
              tap
              glow-cyan
              p-3
              rounded-2xl
              flex
              gap-4
              items-center
            "
          >

            {/* THUMB */}

            <div
              className="
                w-20
                h-20
                rounded-xl
                overflow-hidden
                bg-black
                border
                border-white/10
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

            {/* INFO */}

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

              <p
                className="
                  text-cyan-400/60
                  text-xs
                  mt-1
                "
              >
                Disponible
              </p>

            </div>

            {/* BUTTON */}

            <button

              onClick={() =>

                editMode

                  ? handleReplaceSong(song)

                  : handleAddSong(song)

              }

              className="
                tap
                bg-cyan-500
                text-black
                px-4
                py-2
                rounded-xl
                font-bold
              "
            >

              {editMode
                ? "✓"
                : "+"}

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
          glass
          text-center
          text-zinc-400
        "
      >

        Cola global:
        {" "}
        {activeQueue.length}

      </div>

    </div>

  )

}

export default MobilePage