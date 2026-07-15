import { searchAnimeAV1, getAnimeAV1Episodes, getAnimeAV1Servers } from "./animeav1";

interface Anime1vSearchResult {
  title: string;
  url: string;
}

interface Anime1vEpisode {
  name: string;
  url: string;
  number?: number;
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

export async function searchAnime1v(query: string): Promise<Anime1vSearchResult[]> {
  try {
    const results = await searchAnimeAV1(query);
    return results.map(r => ({
      title: r.title,
      url: r.url,
    }));
  } catch (error) {
    console.error("[Anime1v] search failure, falling back to empty:", error);
    return [];
  }
}

export async function getAnime1vEpisodes(animeUrl: string): Promise<Anime1vEpisode[]> {
  try {
    const episodes = await getAnimeAV1Episodes(animeUrl);
    return episodes.map(e => ({
      name: e.title,
      url: e.url,
      number: e.number,
    }));
  } catch (error) {
    console.error("[Anime1v] episodes failure, falling back to empty:", error);
    return [];
  }
}

export async function getAnime1vEpisodeLinks(episodeUrl: string): Promise<Anime1vEpisodeData> {
  try {
    const servers = await getAnimeAV1Servers(episodeUrl);
    
    const SUB: { server?: string; url: string; quality?: string }[] = [];
    const DUB: { server?: string; url: string; quality?: string }[] = [];

    for (const source of servers) {
      const item = {
        server: source.server,
        url: source.url,
        quality: source.quality,
      };
      if (source.lang === "Latino") {
        DUB.push(item);
      } else {
        SUB.push(item);
      }
    }

    return {
      streamLinks: { SUB, DUB },
      downloadLinks: { SUB: [], DUB: [] },
      downloads: [],
    };
  } catch (error) {
    console.error("[Anime1v] links failure, falling back to empty:", error);
    return {
      streamLinks: { SUB: [], DUB: [] },
      downloadLinks: { SUB: [], DUB: [] },
      downloads: [],
    };
  }
}

