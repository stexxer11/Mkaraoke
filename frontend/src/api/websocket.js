const WS_URL = import.meta.env.VITE_WS_URL

if (!WS_URL) {
  throw new Error("VITE_WS_URL no está definida")
}

let socket = null

export function getSocket() {
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    socket = new WebSocket(
      `${WS_URL.replace("https", "wss").replace("http", "ws")}/ws`
    )
  }

  return socket
}

export function closeSocket() {
  if (socket) {
    socket.close()
    socket = null
  }
}