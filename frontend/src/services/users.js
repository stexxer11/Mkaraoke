import { supabase } from "../lib/supabase"

export async function createUserProfile(
  authUser,
  artistName
) {

  const payload = {
    id: authUser.id,
    email: authUser.email,
    artist_name: artistName
  }

  console.log("CREATING PROFILE:", payload)

  const response = await supabase
    .from("users")
    .upsert(payload)

  console.log("UPSERT RESPONSE:", response)

  if (response.error) {
    throw response.error
  }

  return payload
}

export async function getUserProfile(userId) {

  console.log("GET USER PROFILE:", userId)

  const response = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)

  console.log("PROFILE RESPONSE:", response)

  if (response.error) {
    throw response.error
  }

  return response.data?.[0] || null
}