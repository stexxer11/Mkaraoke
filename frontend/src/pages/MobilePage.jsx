import {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react"

import debounce from "lodash.debounce"
import Swal from "sweetalert2"

import { useKaraoke } from "../context/KaraokeContext"
import { searchYouTube } from "../services/youtubeApi"

function MobilePage() {

  const {
    queue,
    addSong,
    editSong,
    cancelSong,
    deviceId,
    currentSong,
  } = useKaraoke()

  // =========================
  // STATES
  // =========================

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editSongData, setEditSongData] = useState(null)

  const alertOpen = useRef(null)

  // =========================
  // SEARCH
  // =========================

  const debouncedSearch = useMemo(() =>
    debounce(async (value) => {

      if (!value || value.trim().length < 3) {
        setResults([])
        return
      }

      setLoading(true)

      try {
        const data = await searchYouTube(value)
        setResults(data || [])
      } catch (err) {
        console.log(err)
        setResults([])
      }

      setLoading(false)

    }, 700)
  , [])

  const handleSearch = (value) => {
    setSearch(value)
    debouncedSearch(value)
  }

  useEffect(() => {
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // =========================
  // RENDER
  // =========================

  return (

    <div className="mobile">

      {/* HEADER */}
      <div className="mobile-header">

        <h1 className="mobile-title">
          M<span>KARAOKE</span>
        </h1>

        <p className="mobile-subtitle">
          Busca tu canción en YouTube
        </p>

      </div>

      {/* SEARCH */}
      <div className="mobile-search">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={editMode ? "Buscar reemplazo..." : "Buscar canción..."}
          className="mobile-input"
        />
      </div>

      {/* RESULTS */}
      <div className="mobile-results">

        {loading && (
          <p className="loading">Buscando...</p>
        )}

        {results.map(song => (
          <div key={song.youtubeId} className="song-card">

            <div className="song-thumb">
              <img
                src={`https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`}
              />
            </div>

            <div className="song-info">
              <p className="song-title">{song.title}</p>
              <p className="song-artist">{song.artist}</p>
            </div>

            <button className="song-btn">
              +
            </button>

          </div>
        ))}

      </div>

      {/* FOOTER */}
      <div className="mobile-footer">
        Cola global: {queue.length}
      </div>

      {/* =========================
          CSS INTERNO
      ========================= */}
      <style jsx>{`

        .mobile {
          min-height: 100vh;
          background: linear-gradient(135deg, #000, #0b0b0f, #0c4a6e);
          color: white;
          display: flex;
          flex-direction: column;
        }

        /* HEADER */
        .mobile-header {
          text-align: center;
          padding: 24px 16px;
        }

        .mobile-title {
          font-size: 3rem;
          font-weight: 900;
          letter-spacing: -1px;
          text-shadow:
            0 0 10px rgba(34, 211, 238, 0.5),
            0 0 25px rgba(34, 211, 238, 0.25),
            0 0 45px rgba(34, 211, 238, 0.15);
        }

        .mobile-title span {
          color: #22d3ee;
          text-shadow:
            0 0 10px rgba(34, 211, 238, 0.7),
            0 0 30px rgba(34, 211, 238, 0.35);
        }

        .mobile-subtitle {
          color: #a1a1aa;
          margin-top: 6px;
        }

        /* SEARCH */
        .mobile-search {
          padding: 10px 16px;
        }

        .mobile-input {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(34, 211, 238, 0.2);
          background: rgba(0,0,0,0.6);
          color: white;
          backdrop-filter: blur(10px);
          outline: none;
        }

        .mobile-input:focus {
          border-color: rgba(34,211,238,0.6);
          box-shadow: 0 0 20px rgba(34,211,238,0.25);
        }

        /* RESULTS */
        .mobile-results {
          flex: 1;
          padding: 10px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .loading {
          color: #71717a;
        }

        .song-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          border-radius: 16px;

          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(34,211,238,0.15);

          backdrop-filter: blur(12px);
          transition: 0.2s;
        }

        .song-card:hover {
          transform: scale(1.01);
          border-color: rgba(34,211,238,0.35);
        }

        .song-thumb img {
          width: 64px;
          height: 64px;
          border-radius: 12px;
          object-fit: cover;
        }

        .song-info {
          flex: 1;
        }

        .song-title {
          font-weight: 700;
        }

        .song-artist {
          font-size: 0.8rem;
          color: #a1a1aa;
        }

        .song-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: rgba(34,211,238,0.15);
          color: #22d3ee;
          font-size: 20px;
          cursor: pointer;
        }

        /* FOOTER */
        .mobile-footer {
          padding: 12px;
          text-align: center;
          font-size: 0.8rem;
          color: #71717a;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

      `}</style>

    </div>
  )
}

export default MobilePage