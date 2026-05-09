import { readPage } from "./client";

const BASE_URL = "https://doramasflix.co";

export interface DoramasflixResult {
  title: string;
  slug: string;
  image: string;
  type: string;
}

export interface DoramasflixEpisode {
  number: number;
  url: string;
}

export interface DoramasflixSource {
  server: string;
  url: string;
}

/**
 * Search for Doramas/Movies on Doramasflix
 */
export async function searchDoramasflix(query: string): Promise<DoramasflixResult[]> {
  try {
    // Doramasflix search page: /buscar?q=query
    const searchUrl = `${BASE_URL}/buscar?q=${encodeURIComponent(query)}`;
    const html = await readPage(searchUrl);
    
    const results: DoramasflixResult[] = [];
    
    // We can extract JSON data or parse the HTML. The HTML has <article class="Card_card__...">
    // Pattern: <a href="/doramas/slug" ...> ... <img src="image" alt="title" ...>
    const itemRegex = /<a[^>]+href="\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    
    while ((match = itemRegex.exec(html)) !== null) {
      const urlPath = match[1];
      const content = match[2];
      
      // Only include doramas or movies
      if (!urlPath.startsWith("doramas/") && !urlPath.startsWith("peliculas/")) continue;
      
      const imgMatch = /<img[^>]+src="([^"]+)"/.exec(content);
      const titleMatch = /alt="([^"]+)"/.exec(imgMatch ? imgMatch[0] : content);
      
      if (urlPath && titleMatch) {
        results.push({
          title: titleMatch[1].trim(),
          slug: `/${urlPath}`,
          image: imgMatch && imgMatch[1].startsWith("http") ? imgMatch[1] : `${BASE_URL}${imgMatch?.[1] || ""}`,
          type: urlPath.startsWith("peliculas/") ? "movie" : "series"
        });
      }
    }
    
    // Remove duplicates
    const uniqueResults = results.filter((v, i, a) => a.findIndex(t => (t.slug === v.slug)) === i);
    return uniqueResults;
  } catch (e) {
    console.error("Doramasflix search error:", e);
    return [];
  }
}

/**
 * Get all episodes for a Doramasflix series
 */
export async function getDoramasflixEpisodes(slug: string): Promise<DoramasflixEpisode[]> {
  try {
    const url = `${BASE_URL}${slug}`;
    const html = await readPage(url);
    const episodes: DoramasflixEpisode[] = [];
    
    // Look for episode links: <a href="/episodios/slug-episodio-1" ...>
    const epRegex = /<a[^>]+href="(\/episodios\/[^"]+)"[^>]*>/g;
    let match;
    
    while ((match = epRegex.exec(html)) !== null) {
      const epUrl = match[1];
      // Extract number from end of URL
      const numMatch = /-episodio-(\d+)/i.exec(epUrl);
      if (numMatch) {
        episodes.push({
          number: parseInt(numMatch[1]),
          url: `${BASE_URL}${epUrl}`
        });
      }
    }
    
    // Remove duplicates and sort
    const unique = episodes.filter((v, i, a) => a.findIndex(t => (t.number === v.number)) === i);
    return unique.sort((a, b) => a.number - b.number);
  } catch (e) {
    console.error("Doramasflix episodes error:", e);
    return [];
  }
}

/**
 * Get video servers for a specific episode or movie
 */
export async function getDoramasflixServers(url: string): Promise<DoramasflixSource[]> {
  try {
    const html = await readPage(url);
    const servers: DoramasflixSource[] = [];
    
    // Look for iframe sources in the HTML, or data objects
    // Doramasflix usually has scripts with server data or direct iframes
    
    // 1. Check for standard iframes
    const iframeRegex = /<iframe[^>]+src="([^"]+)"/g;
    let match;
    while ((match = iframeRegex.exec(html)) !== null) {
      const src = match[1];
      if (src.includes("http") && !src.includes("youtube.com")) {
        servers.push({ server: "Doramasflix Stream", url: src });
      }
    }
    
    // 2. Check for Svelte/NextJS data props (since Doramasflix uses NextJS)
    const jsonRegex = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
    const jsonMatch = jsonRegex.exec(html);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        // Recursive search for "servers" or "url" arrays
        const findServers = (obj: any) => {
          if (!obj) return;
          if (Array.isArray(obj)) {
            obj.forEach(findServers);
          } else if (typeof obj === 'object') {
            if (obj.server && obj.url) {
              servers.push({ server: obj.server, url: obj.url });
            } else if (obj.name && obj.embed) {
              servers.push({ server: obj.name, url: obj.embed });
            }
            Object.values(obj).forEach(findServers);
          }
        };
        findServers(data);
      } catch (e) {}
    }
    
    // Clean up duplicates
    const unique = servers.filter((v, i, a) => a.findIndex(t => (t.url === v.url)) === i);
    return unique;
  } catch (e) {
    console.error("Doramasflix servers error:", e);
    return [];
  }
}
