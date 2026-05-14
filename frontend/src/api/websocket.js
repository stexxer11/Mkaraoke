const WS_URL = import.meta.env.VITE_WS_URL;

if (!WS_URL) {
  throw new Error("VITE_WS_URL no está definida");
}

const base = WS_URL
  .replace("https://", "wss://")
  .replace("http://", "ws://")
  .replace(/\/ws$/, "")   // 🔥 elimina ws si ya existe
  .replace(/\/$/, "");    // 🔥 elimina slash final

const socket = new WebSocket(`${base}/ws`);

socket.onopen = () => {
  console.log("WS conectado");
};

socket.onerror = (err) => {
  console.error("WS error:", err);
};

socket.onclose = (e) => {
  console.log("WS cerrado:", e.code, e.reason);
};

export default socket;