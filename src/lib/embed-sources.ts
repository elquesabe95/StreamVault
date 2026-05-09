// Embed source providers for streaming movies and anime
// These are free embed services that work with TMDB IDs

export interface EmbedSource {
  name: string;
  label: string;
  type: "movie" | "tv" | "both";
  getMovieUrl: (tmdbId: number) => string;
  getTvUrl: (tmdbId: number, season: number, episode: number) => string;
  priority: number; // lower = higher priority
}

const embedSources: EmbedSource[] = [
  {
    name: "pelispedia",
    label: "PelisPedia (Latino)",
    type: "both",
    getMovieUrl: (id) => `${id}`,
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 0,
  },
  {
    name: "jkanime",
    label: "JKAnime (Latino/Sub)",
    type: "tv",
    getMovieUrl: () => "",
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 0,
  },
  {
    name: "anime1v",
    label: "Anime1V (Propio)",
    type: "tv",
    getMovieUrl: () => "",
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 0,
  },
  {
    name: "moviesapi",
    label: "MoviesAPI",
    type: "movie",
    getMovieUrl: (id) => `https://moviesapi.club/movie/${id}`,
    getTvUrl: () => "",
    priority: 7,
  },
];

export function getEmbedSources(type: "movie" | "tv"): EmbedSource[] {
  return embedSources
    .filter((s) => s.type === type || s.type === "both")
    .sort((a, b) => a.priority - b.priority);
}

export function getPrimaryEmbed(type: "movie" | "tv", tmdbId: number, season?: number, episode?: number): string {
  const sources = getEmbedSources(type);
  const primary = sources[0];
  if (!primary) return "";
  return type === "movie"
    ? primary.getMovieUrl(tmdbId)
    : primary.getTvUrl(tmdbId, season || 1, episode || 1);
}

export function getAllEmbeds(type: "movie" | "tv", tmdbId: number, season?: number, episode?: number): { name: string; label: string; url: string }[] {
  return getEmbedSources(type).map((source, index) => ({
    name: source.name,
    label: `Servidor ${index + 1}`,
    url: type === "movie" ? source.getMovieUrl(tmdbId) : source.getTvUrl(tmdbId, season || 1, episode || 1),
  }));
}
