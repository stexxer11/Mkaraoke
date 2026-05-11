const WS_URL = import.meta.env.VITE_WS_URL.replace("https", "wss");

const socket = new WebSocket(`${WS_URL}/ws`);

export default socket;