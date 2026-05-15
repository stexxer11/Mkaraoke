import { supabase } from "../lib/supabase"

export async function addSongToQueue(song, user) {

  if (!user?.id) {
    throw new Error("User not authenticated")
  }

  const payload = {
    title: song.title,
    artist: song.artist,
    youtube_id: song.youtubeId,
    user_id: user.id,
    status: "queued",
    created_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from("songs")
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error("ADD SONG ERROR:", error)
    throw error
  }

  return data
}