import { supabase } from "../lib/supabase"

export async function createUserProfile(authUser, artistName = null) {

  if (!authUser?.id) {
    throw new Error("Missing auth user")
  }

  const payload = {
    id: authUser.id,
    email: authUser.email,
    artist_name: artistName || authUser.user_metadata?.name || null,
    avatar_url: authUser.user_metadata?.avatar_url || null
  }

  console.log("UPSERT PROFILE:", payload)

  const { data, error } = await supabase
    .from("users")
    .upsert(payload)
    .select()
    .single()

  if (error) {
    console.error("UPSERT ERROR:", error)
    throw error
  }

  return data
}