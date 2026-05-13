import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL no está definida");
}

export const searchYouTube = async (query) => {
  if (!query) return [];

  try {
    const res = await axios.get(`${API_URL}/search`, {
      params: { q: query }
    });

    return res.data;

  } catch (err) {
    console.error("YOUTUBE SEARCH ERROR:", err?.response?.data || err.message);
    return [];
  }
};