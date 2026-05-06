const ANIME1V_BASE_URL = process.env.ANIME1V_API_URL || "https://anime1v-api-cloned.onrender.com";
const ANIME1V_API_KEY = process.env.ANIME1V_API_KEY || "";
const ANIME1V_AUTH_DISABLED = process.env.ANIME1V_AUTH_DISABLED === "true";

interface Anime1vSearchResult {
  title: string;
  url: string;
}

interface Anime1vEpisode {
  name: string;
  url: string;
}

interface Anime1vEpisodeData {
  downloads: { quality: string; url: string }[];
}

export async function searchAnime1v(query: string): Promise<Anime1vSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (!ANIME1V_AUTH_DISABLED && ANIME1V_API_KEY) {
    params.set("apiKey", ANIME1V_API_KEY);
  }
  const res = await fetch(`${ANIME1V_BASE_URL}/api/v1/anime/search?${params.toString()}`);
  if (!res.ok) throw new Error(`Anime1V search error ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data.results) return data.results;
  if (data.data) return data.data;
  return [];
}

export async function getAnime1vEpisodes(animeUrl: string): Promise<Anime1vEpisode[]> {
  const params = new URLSearchParams({ url: animeUrl });
  if (!ANIME1V_AUTH_DISABLED && ANIME1V_API_KEY) {
    params.set("apiKey", ANIME1V_API_KEY);
  }
  const res = await fetch(`${ANIME1V_BASE_URL}/api/v1/anime/info?${params.toString()}`);
  if (!res.ok) throw new Error(`Anime1V info error ${res.status}`);
  const data = await res.json();
  return data.episodes || [];
}

export async function getAnime1vEpisodeLinks(episodeUrl: string): Promise<Anime1vEpisodeData> {
  const params = new URLSearchParams({ url: episodeUrl });
  if (!ANIME1V_AUTH_DISABLED && ANIME1V_API_KEY) {
    params.set("apiKey", ANIME1V_API_KEY);
  }
  const res = await fetch(`${ANIME1V_BASE_URL}/api/v1/anime/episode?${params.toString()}`);
  if (!res.ok) throw new Error(`Anime1V episode error ${res.status}`);
  return res.json();
}
