import { readPage } from "./client";

const BASE_URL = "https://yandispoiler.net";

export interface YandiSource {
  server: string;
  url: string;
  lang: "latino" | "spanish" | "subbed";
}

export async function searchYandi(query: string) {
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await readPage(searchUrl, {}, true);
  
  const results: { title: string; url: string; poster?: string }[] = [];
  
  // Pattern: .sideranking-item > .sideranking-link > .sideranking-item-title
  const itemRegex = /sideranking-item[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]+class="[^"]*sideranking-link[^"]*"[^>]*>[\s\S]*?sideranking-item-title[^>]*>([^<]+)</gi;
  let match;
  
  while ((match = itemRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2];
    if (url && title) {
      results.push({ title: title.trim(), url });
    }
  }
  
  // Fallback: simpler article pattern (WordPress theme)
  if (results.length === 0) {
    const articleRegex = /<article[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*title="([^"]+)"[^>]*>/gi;
    while ((match = articleRegex.exec(html)) !== null) {
      results.push({ title: match[2].trim(), url: match[1] });
    }
  }
  
  return results;
}

export async function getYandiSources(pageUrl: string): Promise<YandiSource[]> {
  const html = await readPage(pageUrl, {}, true);
  const sources: YandiSource[] = [];
  
  // Extract iframe URLs
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = iframeRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith("//")) url = "https:" + url;
    if (url.includes('.js') || url.includes('cloudflare') || url.includes('google') || url.includes('.css')) continue;
    
    sources.push({ server: "Yandi", url, lang: "latino" });
  }
  
  // Data attributes for embeds
  const dataRegex = /(?:data-url|data-link|data-src|data-embed)=["']([^"']+)["']/gi;
  while ((match = dataRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith("//")) url = "https:" + url;
    if (!url.startsWith("http")) continue;
    sources.push({ server: "Yandi", url, lang: "latino" });
  }
  
  return sources;
}

export async function getYandiEpisodeUrl(seriesUrl: string, season: number, episode: number): Promise<string | null> {
  try {
    const html = await readPage(seriesUrl, {}, true);
    
    const patterns = [
      `-${season}x${episode}`,
      `temporada-${season}-capitulo-${episode}`,
      `season-${season}-episode-${episode}`,
    ];
    
    const linksRegex = /href="([^"]+)"/g;
    let match;
    while ((match = linksRegex.exec(html)) !== null) {
      const url = match[1];
      for (const pattern of patterns) {
        if (url.includes(pattern)) {
          return url.startsWith("http") ? url : `${BASE_URL}${url}`;
        }
      }
    }
  } catch (e) {
    console.error("Yandi episode fetch failed:", e);
  }
  return null;
}
