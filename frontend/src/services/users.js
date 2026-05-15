import { supabase } from "../lib/supabase"

export async function createUserProfile(user, artistName) {

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
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function getUserProfile(userId) {

  const {
    data,
    error
  } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single()

  if (error) {
    return null
  }

  return data
}