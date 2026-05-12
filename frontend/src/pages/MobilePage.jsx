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
    cancelSong,

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

  // =====================================================
  // SEARCH
  // =====================================================

  const debouncedSearch =
    useMemo(() =>

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
              await searchYouTube(value)

            setResults(data || [])

          } catch (err) {

            console.log(err)

            setResults([])

          }

          setLoading(false)

        },

        700

      )

    , [])

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
  // MY SONGS
  // =====================================================

  const mySongs =
    useMemo(() => {

      return queue.filter(

        song =>

          song.ownerId ===
            deviceId &&

          song.status !==
            "done" &&

          song.status !==
            "cancelled"

      )

    }, [

      queue,
      deviceId

    ])

  // =====================================================
  // MY ACTIVE SONG
  // =====================================================

  const myActiveSong =
    useMemo(() => {

      return mySongs[0] || null

    }, [mySongs])

  // =====================================================
  // TURN POSITION
  // =====================================================

  const turnsLeft =
    useMemo(() => {

      if (!myActiveSong)
        return -1

      const activeQueue =
        queue.filter(

          song =>

            song.status ===
              "queued" ||

            song.status ===
              "playing"

        )

      return activeQueue.findIndex(

        song =>
          song.id ===
          myActiveSong.id

      )

    }, [

      queue,
      myActiveSong

    ])

  // =====================================================
  // TURN STATES
  // =====================================================

  const isMyTurn =
    turnsLeft === 0

  const isMySongPlaying =
    currentSong?.id ===
    myActiveSong?.id

  // =====================================================
  // AUTO CLOSE EDIT
  // =====================================================

  useEffect(() => {

    if (

      isMySongPlaying &&
      editMode

    ) {

      setEditMode(false)

      setEditSongData(null)

      setSearch("")

      setResults([])

    }

  }, [

    isMySongPlaying,
    editMode

  ])

  // =====================================================
  // ALERT SYSTEM
  // =====================================================

  useEffect(() => {

    // =========================================
    // NO SONG
    // =========================================

    if (!myActiveSong) {

      alertOpen.current = null

      if (Swal.isVisible()) {

        Swal.close()

      }

      return

    }

    // =========================================
    // PREVENT DUPLICATE ALERTS
    // =========================================

    const alertKey =

      `${myActiveSong.id}-${turnsLeft}-${currentSong?.id}`

    if (
      alertOpen.current === alertKey
    ) {
      return
    }

    alertOpen.current =
      alertKey

    // =========================================
    // SONG PLAYING
    // =========================================

    if (isMySongPlaying) {

      Swal.fire({

        title:
          "Disfruta tu canción 🎤",

        html: `

          <div style="
            text-align:center;
            font-size:16px;
          ">

            <b style="
              font-size:20px;
              color:#22d3ee;
            ">
              ${myActiveSong.title}
            </b>

            <br/><br/>

            <span style="
              color:#d4d4d8;
            ">
              Tu canción ya está sonando
            </span>

          </div>

        `,

        background:
          "#000",

        color:
          "#06b6d4",

        allowOutsideClick:
          false,

        allowEscapeKey:
          false,

        showConfirmButton:
          false,

      })

      return

    }

    // =========================================
    // READY TURN
    // =========================================

    if (isMyTurn) {

      Swal.fire({

        title:
          "Tu turno está listo 🎤",

        html: `

          <div style="
            text-align:center;
            font-size:16px;
          ">

            <b style="
              font-size:20px;
              color:#22d3ee;
            ">
              ${myActiveSong.title}
            </b>

            <br/><br/>

            <span style="
              color:#d4d4d8;
            ">
              Prepárate, eres el siguiente
            </span>

          </div>

        `,

        background:
          "#000",

        color:
          "#06b6d4",

        allowOutsideClick:
          false,

        allowEscapeKey:
          false,

        showConfirmButton:
          false,

        showDenyButton:
          true,

        denyButtonText:
          "Editar canción",

        showCancelButton:
          true,

        cancelButtonText:
          "Cancelar turno",

      }).then(res => {

        // =====================
        // EDIT
        // =====================

        if (

          res.isDenied &&

          !isMySongPlaying

        ) {

          setEditMode(true)

          setEditSongData(
            myActiveSong
          )

          setSearch("")

          setResults([])

        }

        // =====================
        // CANCEL
        // =====================

        if (

          res.dismiss ===
          Swal.DismissReason.cancel

        ) {

          Swal.fire({

            title:
              "¿Cancelar canción?",

            text:
              "Tu turno será eliminado",

            icon:
              "warning",

            background:
              "#000",

            color:
              "#06b6d4",

            showCancelButton:
              true,

            confirmButtonText:
              "Sí, cancelar",

            cancelButtonText:
              "Volver",

          }).then(async confirm => {

            if (
              confirm.isConfirmed
            ) {

              try {

                await cancelSong(
                  myActiveSong.id
                )

                Swal.fire({

                  icon:
                    "success",

                  title:
                    "Turno cancelado",

                  toast:
                    true,

                  position:
                    "top-end",

                  timer:
                    2000,

                  showConfirmButton:
                    false,

                  background:
                    "#000",

                  color:
                    "#06b6d4",

                })

              } catch (err) {

                console.log(err)

              }

            }

          })

        }

      })

      return

    }

    // =========================================
    // WAITING TURN
    // =========================================

    Swal.fire({

      title:
        "Tu canción está en cola",

      html: `

        <div style="
          text-align:center;
          font-size:16px;
        ">

          <b style="
            font-size:20px;
            color:#22d3ee;
          ">
            ${myActiveSong.title}
          </b>

          <br/><br/>

          <span style="
            color:#a1a1aa;
          ">

            Te faltan
            <b style="color:white">
              ${turnsLeft}
            </b>
            turnos

          </span>

        </div>

      `,

      background:
        "#000",

      color:
        "#06b6d4",

      allowOutsideClick:
        false,

      allowEscapeKey:
        false,

      showConfirmButton:
        false,

      showDenyButton:
        true,

      denyButtonText:
        "Editar canción",

      showCancelButton:
        true,

      cancelButtonText:
        "Cancelar turno",

    }).then(res => {

      // =====================
      // EDIT
      // =====================

      if (

        res.isDenied &&

        !isMySongPlaying

      ) {

        setEditMode(true)

        setEditSongData(
          myActiveSong
        )

        setSearch("")

        setResults([])

      }

      // =====================
      // CANCEL
      // =====================

      if (

        res.dismiss ===
        Swal.DismissReason.cancel

      ) {

        Swal.fire({

          title:
            "¿Cancelar canción?",

          text:
            "Tu turno será eliminado",

          icon:
            "warning",

          background:
            "#000",

          color:
            "#06b6d4",

          showCancelButton:
            true,

          confirmButtonText:
            "Sí, cancelar",

          cancelButtonText:
            "Volver",

        }).then(async confirm => {

          if (
            confirm.isConfirmed
          ) {

            try {

              await cancelSong(
                myActiveSong.id
              )

              Swal.fire({

                icon:
                  "success",

                title:
                  "Turno cancelado",

                toast:
                  true,

                position:
                  "top-end",

                timer:
                  2000,

                showConfirmButton:
                  false,

                background:
                  "#000",

                color:
                  "#06b6d4",

              })

            } catch (err) {

              console.log(err)

            }

          }

        })

      }

    })

  }, [

    queue,
    currentSong,

    myActiveSong,

    turnsLeft,

    isMyTurn,
    isMySongPlaying,

    deviceId

  ])

  // =====================================================
  // ADD SONG
  // =====================================================

  const handleAddSong =
    async (song) => {

      if (mySongs.length > 0) {

        Swal.fire({

          icon:
            "warning",

          title:
            "Ya tienes una canción",

          text:
            "Debes esperar tu turno",

          toast:
            true,

          position:
            "top-end",

          timer:
            2000,

          showConfirmButton:
            false,

          background:
            "#000",

          color:
            "#06b6d4",

        })

        return

      }

      try {

        await addSong({

          title:
            song.title,

          artist:
            song.artist,

          youtubeId:
            song.youtubeId,

        })

        Swal.fire({

          icon:
            "success",

          title:
            "Canción agregada",

          toast:
            true,

          position:
            "top-end",

          timer:
            2000,

          showConfirmButton:
            false,

          background:
            "#000",

          color:
            "#06b6d4",

        })

        setSearch("")
        setResults([])

      } catch (err) {

        console.log(err)

      }

    }

  // =====================================================
  // REPLACE SONG
  // =====================================================

  const handleReplaceSong =
    async (song) => {

      if (!editSongData)
        return

      try {

        await editSong(

          editSongData.id,

          {

            title:
              song.title,

            artist:
              song.artist,

            youtubeId:
              song.youtubeId,

          }

        )

        setEditMode(false)

        setEditSongData(null)

        setSearch("")
        setResults([])

        Swal.fire({

          icon:
            "success",

          title:
            "Canción actualizada",

          toast:
            true,

          position:
            "top-end",

          timer:
            2000,

          showConfirmButton:
            false,

          background:
            "#000",

          color:
            "#06b6d4",

        })

      } catch (err) {

        console.log(err)

      }

    }

  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="
      min-h-screen
      bg-black
      text-white
      flex
      flex-col
    ">

      {/* =========================================
          HEADER
      ========================================= */}

      <div className="
        p-5
        border-b
        border-white/10
        backdrop-blur-xl
        bg-zinc-950/80
        sticky
        top-0
        z-50
      ">

        <h1 className="
          text-3xl
          font-black
          text-cyan-400
        ">
          MKaraoke
        </h1>

        <p className="
          text-zinc-400
          mt-1
        ">
          Busca tu canción en YouTube
        </p>

      </div>

      {/* =========================================
          SEARCH
      ========================================= */}

      <div className="
        p-5
        border-b
        border-white/10
      ">

        <input

          value={search}

          onChange={(e) =>
            handleSearch(
              e.target.value
            )
          }

          placeholder={
            editMode
              ? "Buscar reemplazo..."
              : "Buscar canción..."
          }

          className="
            w-full
            p-4
            rounded-2xl
            bg-zinc-900
            border
            border-white/10
            outline-none
            text-white
          "

        />

      </div>

      {/* =========================================
          RESULTS
      ========================================= */}

      <div className="
        flex-1
        overflow-y-auto
        p-5
        space-y-4
      ">

        {loading && (

          <p className="
            text-zinc-500
          ">
            Buscando...
          </p>

        )}

        {results.map(song => (

          <div

            key={song.youtubeId}

            className="
              bg-zinc-900
              border
              border-white/10
              rounded-3xl
              p-3
              flex
              gap-4
              items-center
            "

          >

            {/* THUMB */}

            <div className="
              w-24
              h-24
              rounded-2xl
              overflow-hidden
              shrink-0
            ">

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

            <div className="
              flex-1
              min-w-0
            ">

              <p className="
                font-bold
                truncate
              ">
                {song.title}
              </p>

              <p className="
                text-zinc-400
                text-sm
                truncate
                mt-1
              ">
                {song.artist}
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
                bg-cyan-500
                text-black
                font-black
                px-5
                py-3
                rounded-2xl
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

      <div className="
        p-4
        border-t
        border-white/10
        text-center
        text-zinc-500
        bg-zinc-950
      ">

        Cola global:
        {" "}
        {queue.length}

      </div>

    </div>

  )

}

export default MobilePage