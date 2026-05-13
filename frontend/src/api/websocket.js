const WS_URL = import.meta.env.VITE_WS_URL;

if (!WS_URL) {
  throw new Error("VITE_WS_URL no está definida en las variables de entorno");
}

const socket = new WebSocket(
  `${WS_URL.replace("https", "wss").replace("http", "ws")}/ws`
);

export default socket;