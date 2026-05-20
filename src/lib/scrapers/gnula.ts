import { readPage } from "./client";

const BASE_URL = "https://ww3.gnulahd.nu";

export interface GnulaSource {
  server: string;
  url: string;
  lang: "latino" | "spanish" | "subbed";
}

export async function searchGnula(query: string) {
  const searchUrl = `https://ww3.gnulahd.nu/?s=${encodeURIComponent(query)}`;
  const html = await readPage(searchUrl, {}, true);
  
  const results: { title: string; url: string; poster?: string }[] = [];
  
  // Generic WordPress article pattern — works with any theme
  const itemRegex = /<article[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/gi;
  let match;
  
  while ((match = itemRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2];
    if (url && title) {
      const fullUrl = url.startsWith("http") ? url : `https://ww3.gnulahd.nu${url.startsWith("/") ? "" : "/"}${url}`;
      results.push({ title: title.trim(), url: fullUrl });
    }
  }
  
  return results;
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
    else if (url.startsWith("/")) url = "https://ww3.gnulahd.nu" + url;
    if (url.includes('.js') || url.includes('cloudflare') || url.includes('google') || url.includes('.css') || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('short.icu') || url.includes('embed69')) continue;
    
    sources.push({ server: "Gnula", url, lang: "latino" });
  }
  
  // Try data attributes for video sources
  const dataRegex = /(?:data-url|data-link|data-src|data-player|data-embed|data-video)=["']([^"']+)["']/gi;
  while ((match = dataRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith("//")) url = "https:" + url;
    if (!url.startsWith("http")) continue;
    sources.push({ server: "Gnula", url, lang: "latino" });
  }
  
  // Try JavaScript embedded URLs (file:, source:, video: patterns)
  const jsUrlRegex = /(?:file|source|video|src)\s*:\s*["'](https?:\/\/[^"']+)["']/gi;
  while ((match = jsUrlRegex.exec(html)) !== null) {
    sources.push({ server: "Gnula", url: match[1], lang: "latino" });
  }
  
  // Try option values in selects (server chooser)
  const optionRegex = /<option[^>]+value="(https?:\/\/[^"]+)"[^>]*>/gi;
  while ((match = optionRegex.exec(html)) !== null) {
    sources.push({ server: "Gnula", url: match[1], lang: "latino" });
  }
  
  // Try .m3u8 and .mp4 direct links anywhere in the page
  const directRegex = /(https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*)/gi;
  while ((match = directRegex.exec(html)) !== null) {
    sources.push({ server: "Gnula", url: match[1], lang: "latino" });
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
