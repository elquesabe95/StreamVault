import { readPage } from "./client";

const BASE_URL = "https://ww3.gnulahd.nu";

export interface GnulaSource {
  server: string;
  url: string;
  lang: "latino" | "spanish" | "subbed";
}

export async function searchGnula(query: string) {
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await readPage(searchUrl, {}, true);
  
  const results: { title: string; url: string; poster?: string }[] = [];
  
  // Pattern: article.bs.styleegg > a.tip with href and title
  const itemRegex = /<article[^>]+class="[^"]*bs[^"]*styleegg[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]+class="[^"]*tip[^"]*"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/gi;
  let match;
  
  while ((match = itemRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2];
    if (url && title) {
      results.push({ title: title.trim(), url });
    }
  }
  
  // Fallback: simpler pattern
  if (results.length === 0) {
    const simpleRegex = /<article[^>]+class="[^"]*bs[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/gi;
    while ((match = simpleRegex.exec(html)) !== null) {
      results.push({ title: match[2].trim(), url: match[1] });
    }
  }
  
  return results;
}

export async function getGnulaSources(pageUrl: string): Promise<GnulaSource[]> {
  const html = await readPage(pageUrl, {}, true);
  const sources: GnulaSource[] = [];
  
  // Extract iframe/embed URLs from the page
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = iframeRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith("//")) url = "https:" + url;
    if (url.includes('.js') || url.includes('cloudflare') || url.includes('google') || url.includes('.css') || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('short.icu')) continue;
    
    sources.push({ server: "Gnula", url, lang: "latino" });
  }
  
  // Try to find server buttons/options
  const serverRegex = /(?:data-url|data-link|data-src)=["']([^"']+)["']/gi;
  while ((match = serverRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith("//")) url = "https:" + url;
    sources.push({ server: "Gnula", url, lang: "latino" });
  }
  
  return sources;
}

export async function getGnulaEpisodeUrl(seriesUrl: string, season: number, episode: number): Promise<string | null> {
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
    console.error("Gnula episode fetch failed:", e);
  }
  return null;
}
