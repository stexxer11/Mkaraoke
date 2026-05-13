import { api, supabase } from "./api"

export const registerUserApi = async (deviceId, name) => {
  const { data, error } = await supabase
    .from("users")
    .upsert([
      {
        device_id: deviceId,
        name: name,
      },
    ])

  if (error) {
    console.error("Error registrando usuario:", error)
    return null
  }

  return data
}