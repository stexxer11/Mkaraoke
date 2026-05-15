import { supabase } from "../lib/supabase"

export async function createUserProfile(
  user,
  artistName
) {

  const payload = {
    id: user.id,
    email: user.email,
    artist_name: artistName
  }

  const {
    data,
    error
  } = await supabase
    .from("users")
    .upsert(payload)
    .select()

  console.log("UPSERT DATA:", data)
  console.log("UPSERT ERROR:", error)

  if (error) {
    throw error
  }

  return data?.[0]
}

export async function getUserProfile(userId) {

  const {
    data,
    error
  } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)

  if (error) {
    console.error(error)
    return null
  }

  return data?.[0]
}