const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function getTmdbKey(): string {
  // Allow override via env var; otherwise use a demo key
  return process.env.TMDB_API_KEY || "2dca580c2a14b55200e784d157207b4d";
}

interface FetchOptions {
  method?: string;
  body?: Record<string, unknown>;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}, options: FetchOptions = {}): Promise<T> {
  const key = getTmdbKey();
  const searchParams = new URLSearchParams({ api_key: key, language: "es-ES", ...params });

  const url = `${TMDB_BASE_URL}${endpoint}?${searchParams.toString()}`;
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...((options.method && options.method !== "GET") ? {} : {}) },
    next: { revalidate: 3600 }, // cache for 1 hour
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`TMDB API error ${res.status}: ${errBody}`);
  }

  return res.json();
}

// ── Image helpers ──

export function tmdbImage(path: string | null, size: string = "w500"): string {
  if (!path) return "/placeholder-poster.svg";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// ── Search ──

export interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  media_type: string;
  genre_ids: number[];
  popularity: number;
}

export interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchResult[];
  total_pages: number;
  total_results: number;
}

export async function searchMulti(query: string, page = 1): Promise<TmdbSearchResponse> {
  const data = await tmdbFetch<TmdbSearchResponse>("/search/multi", { query, page: String(page) });
  // Filter only movies and tv shows
  data.results = data.results.filter((r) => r.media_type === "movie" || r.media_type === "tv");
  return data;
}

export async function searchMovies(query: string, page = 1): Promise<TmdbSearchResponse> {
  return tmdbFetch<TmdbSearchResponse>("/search/movie", { query, page: String(page), include_adult: "false" });
}

export async function searchTv(query: string, page = 1): Promise<TmdbSearchResponse> {
  return tmdbFetch<TmdbSearchResponse>("/search/tv", { query, page: String(page) });
}

// ── Movie Details ──

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  production_companies: { id: number; name: string; logo_path: string | null }[];
  spoken_languages: { english_name: string; iso_639_1: string }[];
  status: string;
  tagline: string | null;
  adult: boolean;
  budget: number;
  revenue: number;
  homepage: string | null;
  imdb_id: string | null;
  popularity: number;
  belongs_to_collection?: { id: number; name: string; poster_path: string | null; backdrop_path: string | null };
  videos?: {
    results: { id: string; key: string; name: string; site: string; type: string }[];
  };
  similar?: {
    results: TmdbSearchResult[];
  };
  "watch/providers"?: {
    results: Record<string, { flatrate?: { provider_id: number; provider_name: string; logo_path: string }[] }>;
  };
}

export async function getMovieDetails(id: number): Promise<TmdbMovie> {
  return tmdbFetch<TmdbMovie>(`/movie/${id}`, { append_to_response: "videos,similar,watch/providers" });
}

// ── TV Details ──

export interface TmdbSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  overview: string;
  poster_path: string | null;
}

export interface TmdbEpisode {
  id: number;
  season_number: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  vote_average: number;
  runtime: number;
}

export interface TmdbTvShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  status: string;
  tagline: string | null;
  homepage: string | null;
  popularity: number;
  origin_country: string[];
  created_by: { id: number; name: string; profile_path: string | null }[];
  seasons: TmdbSeason[];
  videos?: {
    results: { id: string; key: string; name: string; site: string; type: string }[];
  };
  similar?: {
    results: TmdbSearchResult[];
  };
}

export async function getTvDetails(id: number): Promise<TmdbTvShow> {
  return tmdbFetch<TmdbTvShow>(`/tv/${id}`, { append_to_response: "videos,similar" });
}

export async function getTvSeasonDetails(tvId: number, seasonNumber: number): Promise<{ id: number; episodes: TmdbEpisode[] }> {
  return tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`, { language: "es-ES" });
}

// ── Trending ──

export interface TmdbTrendingResponse {
  page: number;
  results: TmdbSearchResult[];
  total_pages: number;
  total_results: number;
}

export async function getTrending(mediaType: "all" | "movie" | "tv" = "all", timeWindow: "day" | "week" = "week"): Promise<TmdbTrendingResponse> {
  return tmdbFetch<TmdbTrendingResponse>(`/trending/${mediaType}/${timeWindow}`);
}

// ── Discover ──

export interface TmdbDiscoverResponse {
  page: number;
  results: TmdbSearchResult[];
  total_pages: number;
  total_results: number;
}

export async function discoverMovies(params: {
  genre?: string;
  year?: string;
  sortBy?: string;
  page?: number;
} = {}): Promise<TmdbDiscoverResponse> {
  const searchParams: Record<string, string> = {
    sort_by: params.sortBy || "popularity.desc",
    page: String(params.page || 1),
    "vote_count.gte": "50",
    include_adult: "false",
  };
  if (params.genre) searchParams.with_genres = params.genre;
  if (params.year) searchParams.primary_release_year = params.year;
  return tmdbFetch<TmdbDiscoverResponse>("/discover/movie", searchParams);
}

export async function discoverTv(params: {
  genre?: string;
  year?: string;
  sortBy?: string;
  page?: number;
} = {}): Promise<TmdbDiscoverResponse> {
  const searchParams: Record<string, string> = {
    sort_by: params.sortBy || "popularity.desc",
    page: String(params.page || 1),
    "vote_count.gte": "50",
  };
  if (params.genre) searchParams.with_genres = params.genre;
  if (params.year) searchParams.first_air_date_year = params.year;
  return tmdbFetch<TmdbDiscoverResponse>("/discover/tv", searchParams);
}

// ── Genres ──

export interface TmdbGenre {
  id: number;
  name: string;
}

export async function getMovieGenres(): Promise<{ genres: TmdbGenre[] }> {
  return tmdbFetch("/genre/movie/list");
}

export async function getTvGenres(): Promise<{ genres: TmdbGenre[] }> {
  return tmdbFetch("/genre/tv/list");
}

// ── Utility ──

export function getDisplayTitle(item: TmdbSearchResult): string {
  return item.title || item.name || "Sin titulo";
}

export function getDisplayDate(item: TmdbSearchResult): string {
  return item.release_date || item.first_air_date || "";
}

export function getMediaType(item: TmdbSearchResult): "movie" | "tv" {
  return item.media_type === "tv" ? "tv" : "movie";
}
