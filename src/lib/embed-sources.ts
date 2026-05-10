// Embed source providers — fast iframe sources (no scraping needed) + scrapers as fallback

export interface EmbedSource {
  name: string;
  label: string;
  type: "movie" | "tv" | "both";
  getMovieUrl: (tmdbId: number) => string;
  getTvUrl: (tmdbId: number, season: number, episode: number) => string;
  priority: number; // lower = higher priority
  needsScraping?: boolean;
}

const embedSources: EmbedSource[] = [
  // ═══ FAST IFRAME SOURCES (instant, no scraping) ═══
  {
    name: "vidsrc-me",
    label: "VidSrc",
    type: "both",
    getMovieUrl: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
    priority: 1,
    needsScraping: false,
  },
  {
    name: "vidsrc-pro",
    label: "VidSrc PRO",
    type: "both",
    getMovieUrl: (id) => `https://vidsrc.pro/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`,
    priority: 2,
    needsScraping: false,
  },
  {
    name: "vidsrc-icu",
    label: "VidSrc ICU",
    type: "both",
    getMovieUrl: (id) => `https://vidsrc.icu/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`,
    priority: 3,
    needsScraping: false,
  },
  {
    name: "2embed",
    label: "2Embed",
    type: "both",
    getMovieUrl: (id) => `https://www.2embed.cc/embed/${id}`,
    getTvUrl: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
    priority: 4,
    needsScraping: false,
  },
  {
    name: "embed-su",
    label: "EmbedSU",
    type: "both",
    getMovieUrl: (id) => `https://embed.su/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
    priority: 5,
    needsScraping: false,
  },
  {
    name: "vidlink",
    label: "VidLink",
    type: "both",
    getMovieUrl: (id) => `https://vidlink.pro/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
    priority: 6,
    needsScraping: false,
  },
  {
    name: "smashystream",
    label: "SmashyStream",
    type: "both",
    getMovieUrl: (id) => `https://embed.smashystream.com/playere.php?tmdb=${id}`,
    getTvUrl: (id, s, e) => `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`,
    priority: 7,
    needsScraping: false,
  },
  {
    name: "moviesapi",
    label: "MoviesAPI",
    type: "movie",
    getMovieUrl: (id) => `https://moviesapi.club/movie/${id}`,
    getTvUrl: () => "",
    priority: 8,
    needsScraping: false,
  },

  // ═══ SCRAPER SOURCES (slower, used as fallback) ═══
  {
    name: "pelispedia",
    label: "PelisPedia (Latino)",
    type: "both",
    getMovieUrl: (id) => `${id}`,
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 20,
    needsScraping: true,
  },
  {
    name: "cuevana",
    label: "Cuevana (Latino)",
    type: "both",
    getMovieUrl: (id) => `${id}`,
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 21,
    needsScraping: true,
  },
  {
    name: "jkanime",
    label: "JKAnime (Latino/Sub)",
    type: "tv",
    getMovieUrl: () => "",
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 22,
    needsScraping: true,
  },
  {
    name: "anime1v",
    label: "Anime1V",
    type: "tv",
    getMovieUrl: () => "",
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 23,
    needsScraping: true,
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

export function getAllEmbeds(type: "movie" | "tv", tmdbId: number, season?: number, episode?: number): {
  name: string;
  label: string;
  url: string;
  needsScraping?: boolean;
}[] {
  return getEmbedSources(type).map((source, index) => ({
    name: source.name,
    label: source.label,
    url: type === "movie"
      ? source.getMovieUrl(tmdbId)
      : source.getTvUrl(tmdbId, season || 1, episode || 1),
    needsScraping: source.needsScraping,
  }));
}

export function isFastSource(name: string): boolean {
  const source = embedSources.find(s => s.name === name);
  return source ? !source.needsScraping : false;
}
