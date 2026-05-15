import { supabase } from "../lib/supabase"

export async function loginWithGoogle() {

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin
    }
  })

  if (error) {
    throw error
  }
}

export async function logout() {

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function getCurrentSession() {

  const {
    data,
    error
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}