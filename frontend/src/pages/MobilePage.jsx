import { useState } from "react"
import { searchYouTube } from "../services/youtubeApi"

function MobilePage() {

  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (value) => {

    setSearch(value)

    if (value.trim().length < 1) {
      setResults([])
      return
    }

    setLoading(true)

    try {

      const data = await searchYouTube(value)

      console.log(data)

      setResults(data || [])

    } catch (err) {

      console.log(err)

      setResults([])

    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">

      <h1 className="text-4xl font-black text-center mb-6">
        M<span className="text-cyan-400">KARAOKE</span>
      </h1>

      <input
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar canción..."
        className="w-full px-4 py-4 rounded-xl bg-zinc-900 border border-cyan-500/20 outline-none"
      />

      <div className="mt-5 space-y-5">

        {loading && (
          <p className="text-zinc-400">
            Buscando...
          </p>
        )}

        {results.map(song => (

          <div
            key={song.youtubeId}
            className="bg-zinc-900 rounded-2xl overflow-hidden"
          >

            <iframe
              width="100%"
              height="220"
              src={`https://www.youtube.com/embed/${song.youtubeId}`}
              title={song.title}
              allowFullScreen
            />

            <div className="p-4">
              <p className="font-bold">
                {song.title}
              </p>

              <p className="text-sm text-zinc-400 mt-1">
                {song.artist}
              </p>
            </div>

          </div>

        ))}

      </div>

    </div>
  )
}

export default MobilePage