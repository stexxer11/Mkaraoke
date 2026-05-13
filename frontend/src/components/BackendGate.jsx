import { useEffect, useState } from "react"

export default function BackendGate({ children }) {

  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    const checkBackend = async () => {
      try {
        const res = await fetch(import.meta.env.VITE_API_URL + "/status")

        if (res.ok) {
          setReady(true)
        } else {
          setReady(false)
        }

      } catch (err) {
        setReady(false)
      } finally {
        setLoading(false)
      }
    }

    checkBackend()

    // opcional: reintento cada 2s si está dormido
    const interval = setInterval(checkBackend, 2000)

    return () => clearInterval(interval)

  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-cyan-400">
        Despertando servidor...
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-red-500">
        Servidor no disponible
      </div>
    )
  }

  return children
}