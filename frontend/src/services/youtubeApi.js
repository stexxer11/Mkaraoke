import axios from "axios";

const API_URL = "https://mkaraoke-1.onrender.com";

export const searchYouTube = async (query) => {
  if (!query) return [];

  try {
    const res = await axios.get(`${API_URL}/search`, {
      params: { q: query }
    });

    return res.data;

  } catch (err) {
    console.log(err);
    return [];
  }
};