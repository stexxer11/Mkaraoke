import { supabase } from "../lib/supabase"

export async function createUserProfile(authUser, artistName = null) {
  if (!authUser?.id) {
    throw new Error("Missing auth user")
  }

  const payload = {
    id: authUser.id,
    email: authUser.email ?? null,
    artist_name: artistName || authUser.user_metadata?.name || null,
    avatar_url: authUser.user_metadata?.avatar_url || null
  }

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single()

  if (error) throw error

  return data
}

// 👇 ESTE ES EL QUE TE FALTA
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single()

  if (error) return null

  return data
}