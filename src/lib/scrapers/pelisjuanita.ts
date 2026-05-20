import { readPage } from "./client";

const BASE_URL = "https://pelisjuanita.com";

export interface JuanitaSource {
  server: string;
  url: string;
  lang: "latino" | "spanish" | "subbed";
}

export async function searchJuanita(query: string) {
  const searchUrl = `https://pelisjuanita.com/movies/search?s=${encodeURIComponent(query)}`;
  const html = await readPage(searchUrl, {}, true);
  
  const results: { title: string; url: string; poster?: string }[] = [];
  
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2];
    if (url && title && title.trim().length > 2 && !url.includes('javascript') && !url.includes('#')) {
      const fullUrl = url.startsWith("http") ? url : `https://pelisjuanita.com${url.startsWith("/") ? "" : "/"}${url}`;
      if (fullUrl.includes("/pelicula/") || fullUrl.includes("/serie/") || fullUrl.includes("/movies/")) {
        results.push({ title: title.trim(), url: fullUrl });
      }
    }
  }
  
  return results;
}

export async function getJuanitaSources(pageUrl: string): Promise<JuanitaSource[]> {
  const html = await readPage(pageUrl, {}, true);
  const sources: JuanitaSource[] = [];
  
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = iframeRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("/")) url = "https://pelisjuanita.com" + url;
    if (url.includes('.js') || url.includes('cloudflare') || url.includes('google') || url.includes('.css') || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('short.icu')) continue;
    sources.push({ server: "Juanita", url, lang: "latino" });
  }
  
  const embedRegex = /(?:data-src|data-embed|data-url)=["']([^"']+)["']/gi;
  while ((match = embedRegex.exec(html)) !== null) {
    let url = match[1];
    if (!url.startsWith("http")) continue;
    sources.push({ server: "Juanita", url, lang: "latino" });
  }
  
  const optionRegex = /<option[^>]+value="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
  while ((match = optionRegex.exec(html)) !== null) {
    let url = match[1];
    if (!url.startsWith("http")) continue;
    sources.push({ server: match[2].trim(), url, lang: "latino" });
  }
  
  return sources;
}

export async function getJuanitaEpisodeUrl(seriesUrl: string, season: number, episode: number): Promise<string | null> {
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
    console.error("Juanita episode fetch failed:", e);
  }
  return null;
}
