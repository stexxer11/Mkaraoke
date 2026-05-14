import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://zdcehflgcozgbeyvnxpz.supabase.co"

const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkY2VoZmxnY296Z2JleXZueHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDg3ODcsImV4cCI6MjA5NDE4NDc4N30.jMcG38eVGLY6oE52xpbKhfKjaIwKzNlmEHPW1ZU1B4k"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)