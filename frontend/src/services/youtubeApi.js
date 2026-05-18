const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY

export async function searchYouTube(query) {

  if (!query) return []

  try {

    const url =
      `https://www.googleapis.com/youtube/v3/search` +
      `?part=snippet` +
      `&maxResults=10` +
      `&type=video` +
      `&q=${encodeURIComponent(query)}` +
      `&key=${API_KEY}`

    const res = await fetch(url)

    const data = await res.json()

    if (!data.items) return []

    return data.items.map((item) => ({
      youtubeId: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium.url,
    }))

  } catch (err) {
    console.error(err)
    return []
  }
}