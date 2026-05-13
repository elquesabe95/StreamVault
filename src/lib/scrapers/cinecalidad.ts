import { readPage } from "./client";

const BASE_URL = "https://www.cinecalidad.ro";

/**
 * Use readPage with proxy mode + multi-proxy fallback
 */
async function readCC(url: string): Promise<string> {
  return readPage(url, { Referer: BASE_URL + "/" }, true);
}

export interface CineSource {
  server: string;
  url: string;
  lang: "latino" | "spanish" | "subbed";
}

/**
 * Search on CineCalidad
 */
export async function searchCinecalidad(query: string) {
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await readCC(searchUrl);
  
  const results: { title: string; url: string; poster?: string }[] = [];
  
  // Robust pattern
  const itemRegex = /home_post_cont[\s\S]*?href=["']([^"']+)["'][\s\S]*?alt=["']([^"']+)["']/g;
  let match;
  
  while ((match = itemRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2];
    
    if (url && title) {
      results.push({
        title: title.trim(),
        url: url.replace(/['"]/g, "")
      });
    }
  }
  
  return results;
}

/**
 * Extract sources from CineCalidad
 */
export async function getCinecalidadSources(pageUrl: string): Promise<CineSource[]> {
  const html = await readCC(pageUrl);
  const sources: CineSource[] = [];
  
  // Pattern: service=OnlineFilemoon data=zlvmrrhp68nw
  const sourceRegex = /service=["']?Online([^"'\s>]+)["']?\s+data=["']?([^"'\s>]+)["']?/g;
  let match;
  
  while ((match = sourceRegex.exec(html)) !== null) {
    const server = match[1]; // e.g. Filemoon
    const data = match[2];   // e.g. zlvmrrhp68nw
    
    let url = "";
    if (server === "Filemoon") url = `https://filemoon.sx/e/${data}`;
    else if (server === "Voe") url = `https://voe.sx/e/${data}`;
    else if (server === "Doodstream") url = `https://dood.to/e/${data}`;
    else if (server === "Mega") url = `https://mega.nz/embed/${data}`;
    
    if (url) {
      sources.push({
        server: server,
        url: url,
        lang: "latino"
      });
    }
  }

  // Also keep iframe fallback
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/g;
  while ((match = iframeRegex.exec(html)) !== null) {
    const url = match[1];
    if (url.includes("embed") || url.includes("player")) {
      sources.push({
        server: "Embed",
        url: url.startsWith("//") ? `https:${url}` : url,
        lang: "latino"
      });
    }
  }
  
  return sources;
}

/**
 * Get the episode URL from a series page
 */
export async function getCinecalidadEpisodeUrl(seriesUrl: string, season: number, episode: number): Promise<string | null> {
  try {
    const html = await readCC(seriesUrl);
    const searchString = `-${season}x${episode}`;
    const searchString2 = `season-${season}-episode-${episode}`;
    
    const linksRegex = /href="([^"]+)"/g;
    let match;
    while ((match = linksRegex.exec(html)) !== null) {
      const url = match[1];
      if (url.includes(searchString) || url.includes(searchString2)) {
        return url.startsWith("http") ? url : `${BASE_URL}${url}`;
      }
    }
    
    // Fallback: guess the URL
    let slug = seriesUrl.split('/').filter(Boolean).pop();
    if (slug) {
      return `${BASE_URL}/episodio/${slug}-${season}x${episode}/`;
    }
  } catch (e) {
    console.error("Cinecalidad episode fetch failed:", e);
  }
  return null;
}
