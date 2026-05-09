import { readPage } from "./client";

// Cuevana rotates domains. Try multiple.
const DOMAINS = [
  "https://cuevana.biz",
  "https://cuevana.pro",
  "https://cuevana3.ch",
  "https://cuevana3.me",
  "https://cuevana3.cc",
];

export interface CuevanaSource {
  server: string;
  url: string;
  lang: "latino" | "spanish" | "subbed";
}

async function getWorkingBase(): Promise<string> {
  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  };

  for (const domain of DOMAINS) {
    try {
      const res = await fetch(`${domain}/`, {
        signal: AbortSignal.timeout(6000),
        headers: commonHeaders
      });
      if (res.status === 200) {
        const html = await res.text();
        if (html.length > 5000) return domain;
      }
    } catch (_) {}
  }
  return DOMAINS[0]; 
}

/**
 * Search for content on Cuevana
 */
export async function searchCuevana(query: string) {
  const BASE_URL = await getWorkingBase();
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await readPage(searchUrl);
  
  const results: { title: string; url: string; poster?: string }[] = [];
  
  // Robust pattern that handles different Cuevana themes
  const patterns = [
    /TPostMnv[\s\S]*?href=["']([^"']+)["'][\s\S]*?<h2[^>]*class=["']Title["'][^>]*>([^<]+)<\/h2>/g,
    /href=["'](https?:\/\/[^"']*\/(?:serie|pelicula|film)\/[^"']+)["'][^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/g,
    /class=["'][^"']*TPostMn[^"']*["'][\s\S]*?href=["']([^"']+)["'][\s\S]*?title=["']([^"']+)["']/g,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1];
      const title = match[2];
      if (url && title) {
        results.push({ title: title.trim(), url });
      }
    }
    if (results.length > 0) break;
  }
  
  return results;
}

/**
 * Extract sources from Cuevana
 */
export async function getCuevanaSources(pageUrl: string): Promise<CuevanaSource[]> {
  const html = await readPage(pageUrl);
  const sources: CuevanaSource[] = [];
  
  // 1. Try TPlayer divs or servers script
  const serversRegex = /var\s+iframeSrc\s*=\s*['"]([^'"]+)['"]/g;
  let sMatch;
  while ((sMatch = serversRegex.exec(html)) !== null) {
      sources.push({ server: "Cuevana Source", url: sMatch[1], lang: "latino" });
  }

  const playerRegex = /<div[^>]+class="[^"]*TPlayer[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  let match;
  while ((match = playerRegex.exec(html)) !== null) {
    const content = match[1];
    const iframeMatch = /<iframe[^>]+src=["']([^"']+)["']/.exec(content);
    if (iframeMatch) {
      let url = iframeMatch[1];
      if (url.startsWith("//")) url = "https:" + url;
      sources.push({ server: "Cuevana Player", url, lang: "latino" });
    }
  }
  
  // 2. Fallback: any iframe with embed/player in URL
  if (sources.length === 0) {
    const iframeRegex = /<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
    let iMatch;
    while ((iMatch = iframeRegex.exec(html)) !== null) {
      const url = iMatch[1];
      if (url.includes('.js') || url.includes('cloudflare') || url.includes('google')) continue;
      sources.push({ server: "Cuevana Embed", url, lang: "latino" });
    }
  }
  
  return sources;
}

/**
 * Get the episode URL from a series page
 */
export async function getCuevanaEpisodeUrl(seriesUrl: string, season: number, episode: number): Promise<string | null> {
  try {
    const BASE_URL = DOMAINS.find(d => seriesUrl.startsWith(d)) || DOMAINS[0];
    const html = await readPage(seriesUrl);
    
    // Multiple patterns for episode URLs
    const searchPatterns = [
      `-${season}x${episode}`,
      `season-${season}-episode-${episode}`,
      `temporada-${season}-episodio-${episode}`,
      `/episodio/`,
    ];
    
    const linksRegex = /href=["']([^"']+)["']/g;
    let match;
    const episodeLinks: string[] = [];
    
    while ((match = linksRegex.exec(html)) !== null) {
      const url = match[1];
      for (const pattern of searchPatterns.slice(0, 3)) {
        if (url.includes(pattern)) {
          return url.startsWith("http") ? url : `${BASE_URL}${url}`;
        }
      }
      // Collect all episodio links for pattern 4
      if (url.includes('/episodio/')) episodeLinks.push(url);
    }
    
    // If we have episode links, try to find the right one
    if (episodeLinks.length > 0) {
      // Episodio links are usually ordered; pick season*100+episode index
      const targetIndex = (season - 1) * 50 + (episode - 1); // rough estimate
      return episodeLinks[Math.min(targetIndex, episodeLinks.length - 1)];
    }
    
    // No guessing.
  } catch (e) {
    console.error("Cuevana episode fetch failed:", e);
  }
  return null;
}
