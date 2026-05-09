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
  downloads?: { quality?: string; url: string; server?: string }[];
  streamLinks?: {
    SUB?: { server?: string; url: string; quality?: string }[];
    DUB?: { server?: string; url: string; quality?: string }[];
  };
  downloadLinks?: {
    SUB?: { server?: string; url: string; quality?: string }[];
    DUB?: { server?: string; url: string; quality?: string }[];
  };
  variants?: {
    SUB?: number;
    DUB?: number;
  };
}

function authParams(params: URLSearchParams) {
  if (!ANIME1V_AUTH_DISABLED && ANIME1V_API_KEY) {
    params.set("apiKey", ANIME1V_API_KEY);
  }
  return params;
}

function authHeaders(): HeadersInit {
  return !ANIME1V_AUTH_DISABLED && ANIME1V_API_KEY
    ? { "X-API-Key": ANIME1V_API_KEY }
    : {};
}

function unwrapData(data: any) {
  return data?.data || data;
}

export async function searchAnime1v(query: string): Promise<Anime1vSearchResult[]> {
  const params = authParams(new URLSearchParams({ q: query, domain: "animeav1.com" }));
  const res = await fetch(`${ANIME1V_BASE_URL}/api/v1/anime/search?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Anime1V search error ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  const payload = unwrapData(data);
  if (Array.isArray(payload)) return payload;
  if (payload.results) return payload.results;
  return [];
}

export async function getAnime1vEpisodes(animeUrl: string): Promise<Anime1vEpisode[]> {
  const params = authParams(new URLSearchParams({ url: animeUrl }));
  const res = await fetch(`${ANIME1V_BASE_URL}/api/v1/anime/info?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Anime1V info error ${res.status}`);
  const data = await res.json();
  const payload = unwrapData(data);
  return payload.episodes || [];
}

export async function getAnime1vEpisodeLinks(episodeUrl: string): Promise<Anime1vEpisodeData> {
  const params = authParams(new URLSearchParams({
    url: episodeUrl,
    excludeServers: "mega,1fichier",
  }));
  const res = await fetch(`${ANIME1V_BASE_URL}/api/v1/anime/episode?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Anime1V episode error ${res.status}`);
  const data = await res.json();
  return unwrapData(data);
}
