const WS_URL = import.meta.env.VITE_WS_URL

if (!WS_URL) {
  throw new Error("VITE_WS_URL no está definida")
}

let socket = null
let reconnectTimeout = null

export function getSocket(onReady, onClose) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket
  }

  socket = new WebSocket(
    `${WS_URL.replace("https", "wss").replace("http", "ws")}/ws`
  )

  socket.onopen = () => {
    console.log("WS conectado")
    onReady?.()
  }

  socket.onclose = () => {
    console.log("WS cerrado")

    onClose?.()

    reconnectTimeout = setTimeout(() => {
      getSocket(onReady, onClose)
    }, 2000)
  }

  socket.onerror = () => {
    socket?.close()
  }

  return socket
}

export function closeSocket() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout)
  socket?.close()
  socket = null
}