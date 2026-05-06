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

  {
    name: "pelispedia",
    label: "PelisPedia (Latino)",
    type: "both",
    getMovieUrl: (id) => `${id}`, // We'll use the ID to search or use a specific proxy
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 0, // Top priority for Latino content
  },
  {
    name: "jkanime",
    label: "JKAnime (Anime)",
    type: "tv",
    getMovieUrl: () => "",
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 0,
  },
  {
    name: "vidsrc",
    label: "VidSrc",
    type: "both",
    getMovieUrl: (id) => `https://vidsrc.xyz/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`,
    priority: 1,
  },
  {
    name: "vidsrc-cc",
    label: "VidSrc CC",
    type: "both",
    getMovieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
    priority: 2,
  },
  {
    name: "vidsrc-icu",
    label: "VidSrc ICU",
    type: "both",
    getMovieUrl: (id) => `https://vidsrc.icu/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`,
    priority: 3,
  },
  {
    name: "multiembed",
    label: "MultiEmbed",
    type: "movie",
    getMovieUrl: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    getTvUrl: () => "",
    priority: 4,
  },
  {
    name: "embed",
    label: "2Embed",
    type: "both",
    getMovieUrl: (id) => `https://www.2embed.cc/embed/${id}`,
    getTvUrl: (id, s, e) => `https://www.2embed.cc/embedtv/${id}/${s}/${e}`,
    priority: 5,
  },
  {
    name: "automovie",
    label: "AutoMovie",
    type: "both",
    getMovieUrl: (id) => `https://automovie.space/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://automovie.space/embed/tv/${id}/${s}/${e}`,
    priority: 6,
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
  return getEmbedSources(type).map((source) => ({
    name: source.name,
    label: source.label,
    url: type === "movie" ? source.getMovieUrl(tmdbId) : source.getTvUrl(tmdbId, season || 1, episode || 1),
  }));
}
