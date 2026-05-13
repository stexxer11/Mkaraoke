import { BrowserRouter, Routes, Route } from "react-router-dom"
import { useEffect, useState } from "react"

import MobilePage from "./pages/MobilePage"
import TvPage from "./pages/TvPage"
import AdminPage from "./pages/AdminPage"

import { getSocket } from "..src/api/websocket"

function App() {

  const [wsReady, setWsReady] = useState(false)
  const [user, setUser] = useState(null)

  // =====================================================
  // 1. WS BOOT GLOBA
  // =====================================================
  useEffect(() => {

    const ws = getSocket(
      () => setWsReady(true),
      () => setWsReady(false)
    )

    return () => ws?.close()

  }, [])

  // =====================================================
  // 2. LOGIN SOLO CUANDO WS ESTÁ LISTO
  // =====================================================
  useEffect(() => {

    if (!wsReady) return

    const saved = localStorage.getItem("mk_user")

    if (saved) {
      setUser(JSON.parse(saved))
      return
    }

    import("sweetalert2").then(({ default: Swal }) => {

      Swal.fire({
        title: "Bienvenido a MKARAOKE",
        text: "Ingresa tu nombre",
        input: "text",
        allowOutsideClick: false,
        confirmButtonText: "Entrar",
        inputValidator: (v) => {
          if (!v) return "Requerido"
        }
      }).then((res) => {

        if (!res.isConfirmed) return

        const newUser = {
          name: res.value,
          deviceId: crypto.randomUUID(),
          createdAt: Date.now()
        }

        localStorage.setItem("mk_user", JSON.stringify(newUser))
        setUser(newUser)
      })
    })

  }, [wsReady])

  // =====================================================
  // 3. BLOQUEO GLOBAL (ANTES DE ROUTER)
  // =====================================================
  if (!wsReady) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Conectando servidor...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Cargando usuario...
      </div>
    )
  }

  // =====================================================
  // 4. APP NORMAL
  // =====================================================
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<MobilePage user={user} />} />
        <Route path="/tv" element={<TvPage user={user} />} />
        <Route path="/admin" element={<AdminPage user={user} />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App