import { supabase } from "../lib/supabase"

export async function addSongToQueue(song, user) {

  const payload = {
    title: song.title,
    artist: song.artist,
    youtube_id: song.youtubeId,
    owner_id: user.id
  }

  const { data, error } = await supabase
    .from("queue")
    .insert(payload)
    .select()
    .single()

  if (error) throw error

  return data
}