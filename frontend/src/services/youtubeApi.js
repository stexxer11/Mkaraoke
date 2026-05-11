import axios from "axios";

export const searchYouTube = async (query) => {
  if (!query) return [];

  try {
    const res = await axios.get("http://localhost:8000/search", {
      params: { q: query }
    });

    return res.data;

  } catch (err) {
    console.log(err);
    return [];
  }
};