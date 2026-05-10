import { readPage } from "./client";

const BASE_URL = "https://pelispedia.mov";

export interface PelisSource {
  server: string;
  url: string;
  lang: "latino" | "spanish" | "subbed";
}

export async function searchPelispedia(query: string) {
  // Use the correct search pattern: /search?s=query
  const searchUrl = `${BASE_URL}/search?s=${encodeURIComponent(query)}`;
  const html = await readPage(searchUrl, {}, false);
  
  const results: { title: string; url: string; poster?: string }[] = [];
  
  // Robust regex that doesn't break on nested divs
  const itemRegex = /movie-card[\s\S]*?href=["']([^"']+)["'][\s\S]*?<h4[^>]*>([^<]+)<\/h4>/g;
  let match;
  
  while ((match = itemRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2];
    
    if (url && title) {
      results.push({
        title: title.trim(),
        url: url.startsWith("http") ? url : `${BASE_URL}${url}`
      });
    }
  }
  
  return results;
}

/**
 * Extract video sources from a PelisPedia page
 */
export async function getPelispediaSources(pageUrl: string): Promise<PelisSource[]> {
  const html = await readPage(pageUrl, {}, false);
  const sources: PelisSource[] = [];
  
  // 1. Extract server names from buttons (try multiple patterns)
  const serverNames: string[] = [];
  const serverBtnRegex = /<button[^>]+class="[^"]*server[^"]*"[^>]*>([\s\S]*?)<\/button>/gi;
  let sMatch;
  while ((sMatch = serverBtnRegex.exec(html)) !== null) {
    const text = sMatch[1].replace(/<[^>]+>/g, '').trim();
    if (text) serverNames.push(text);
  }

  // 2. Extract iframes from player divs (handles nested divs by scanning for src)
  const playerDivRegex = /<div[^>]+id="player-(\d+)"[^>]*>[\s\S]*?src=["']((?:https?:)?\/\/[^"']+)["']/g;
  let pMatch;
  
  while ((pMatch = playerDivRegex.exec(html)) !== null) {
    const index = parseInt(pMatch[1]);
    let url = pMatch[2];
    if (url.startsWith("//")) url = "https:" + url;
    
    // Skip non-video resources
    if (url.includes('.js') || url.includes('cloudflare') || url.includes('google') || url.includes('.css')) continue;
    
    sources.push({
      server: serverNames[index] || `Servidor ${index + 1}`,
      url: url,
      lang: "latino"
    });
  }
  
  // 3. Fallback: catch any remaining iframes with video-like URLs
  const iframeRegex = /<iframe[^>]+src=["']((?:https?:)?\/\/[^"']+)["']/gi;
  let iMatch;
  while ((iMatch = iframeRegex.exec(html)) !== null) {
    let url = iMatch[1];
    if (url.startsWith("//")) url = "https:" + url;
    if (url.includes('.js') || url.includes('cloudflare') || url.includes('google')) continue;
    
    // If it's a known multi-server host, we'll handle it in the resolver
    sources.push({
      server: "Multi-Server",
      url: url,
      lang: "latino"
    });
  }
  
  return sources;
}

/**
 * Get the episode URL from a series page
 */
export async function getPelispediaEpisodeUrl(seriesUrl: string, season: number, episode: number): Promise<string | null> {
  try {
    const html = await readPage(seriesUrl, {}, true);
    
    // Primary pattern: /serie/slug/temporada/S/capitulo/E (confirmed from live site)
    const primaryPattern = new RegExp(`/serie/[^"]+/temporada/${season}/capitulo/${episode}[^"]*`, 'i');
    const primaryMatch = primaryPattern.exec(html);
    if (primaryMatch) {
      return `${BASE_URL}${primaryMatch[0]}`;
    }
    
    // Secondary patterns used by some sites
    const searchPatterns = [
      `-${season}x${episode}`,
      `season-${season}-episode-${episode}`,
      `temporada-${season}-episodio-${episode}`,
    ];
    
    const linksRegex = /href="([^"]+)"/g;
    let match;
    while ((match = linksRegex.exec(html)) !== null) {
      const url = match[1];
      for (const pattern of searchPatterns) {
        if (url.includes(pattern)) {
          return url.startsWith("http") ? url : `${BASE_URL}${url}`;
        }
      }
    }
    
    // No guessing.
  } catch (e) {
    console.error("Pelispedia episode fetch failed:", e);
  }
  return null;
}
