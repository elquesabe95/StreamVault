// Embed source providers — Spanish-language scrapers

export interface EmbedSource {
  name: string;
  label: string;
  type: "movie" | "tv" | "both";
  getMovieUrl: (tmdbId: number) => string;
  getTvUrl: (tmdbId: number, season: number, episode: number) => string;
  priority: number;
  needsScraping?: boolean;
}

const embedSources: EmbedSource[] = [
  {
    name: "pelispedia",
    label: "PelisPedia (Latino)",
    type: "both",
    getMovieUrl: (id) => `${id}`,
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 0,
    needsScraping: true,
  },
  {
    name: "cuevana",
    label: "Cuevana (Latino)",
    type: "both",
    getMovieUrl: (id) => `${id}`,
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 1,
    needsScraping: true,
  },
  {
    name: "cinecalidad",
    label: "CineCalidad (Latino)",
    type: "both",
    getMovieUrl: (id) => `${id}`,
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 2,
    needsScraping: true,
  },
  {
    name: "jkanime",
    label: "JKAnime (Latino/Sub)",
    type: "tv",
    getMovieUrl: () => "",
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 3,
    needsScraping: true,
  },
  {
    name: "animeflv",
    label: "AnimeFLV (Latino/Sub)",
    type: "tv",
    getMovieUrl: () => "",
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 4,
    needsScraping: true,
  },
  {
    name: "doramasflix",
    label: "DoramasFlix (Latino/Sub)",
    type: "both",
    getMovieUrl: (id) => `${id}`,
    getTvUrl: (id, s, e) => `${id}/${s}/${e}`,
    priority: 5,
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
