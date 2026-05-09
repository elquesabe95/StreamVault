import { readPage } from "./client";

const BASE_URL = "https://jkanime.net";

export interface JKAnimeResult {
  title: string;
  slug: string;
  image: string;
  type: string;
}

export interface JKAnimeEpisode {
  number: number;
  url: string;
}

export interface JKAnimeServer {
  name: string;
  remote: string;
}

/**
 * Search for anime on JKAnime
 */
export async function searchJKAnime(query: string): Promise<JKAnimeResult[]> {
  // JKAnime current search URL: https://jkanime.net/buscar/query/
  const searchUrl = `${BASE_URL}/buscar/${encodeURIComponent(query).replace(/%20/g, "_")}/`;
  const html = await readPage(searchUrl);
  
  const results: JKAnimeResult[] = [];
  const animeRegex = /<div class="anime__item">([\s\S]*?)<h5>/g;
  let match;
  
  while ((match = animeRegex.exec(html)) !== null) {
    const content = match[1];
    
    // Flexible link extraction
    const urlMatch = /href="(https:\/\/jkanime\.net\/[^/]+\/)"/.exec(content);
    const titleMatch = /<a[^>]*>([^<]+)<\/a>/.exec(content);
    const imgMatch = /data-setbg="([^"]+)"/.exec(content);
    
    if (urlMatch && titleMatch) {
      const slug = urlMatch[1].split('/').filter(Boolean).pop() || "";
      results.push({
        title: titleMatch[1].trim(),
        slug: slug,
        image: imgMatch ? imgMatch[1] : "",
        type: "anime"
      });
    }
  }
  
  return results;
}

/**
 * Get all episodes for an anime using the counter logic
 */
export async function getJKAnimeEpisodes(slug: string): Promise<JKAnimeEpisode[]> {
  const url = `${BASE_URL}/${slug}/`;
  const html = await readPage(url);
  
  const episodes: JKAnimeEpisode[] = [];
  
  // Extract total episodes from: <li><span>Episodios:</span> 12</li>
  const epCountMatch = /<li><span>Episodios:<\/span>\s*(\d+)<\/li>/.exec(html);
  
  if (epCountMatch) {
    const totalEpisodes = parseInt(epCountMatch[1]);
    for (let i = 1; i <= totalEpisodes; i++) {
      episodes.push({
        number: i,
        url: `${BASE_URL}/${slug}/${i}/`
      });
    }
  } else {
    // Fallback: try to find episodes in the HTML
    const epRegex = /href="https:\/\/jkanime\.net\/([^/]+)\/(\d+)\/"/g;
    let match;
    const seen = new Set<number>();
    while ((match = epRegex.exec(html)) !== null) {
      const epNum = parseInt(match[2]);
      if (!seen.has(epNum)) {
        seen.add(epNum);
        episodes.push({ number: epNum, url: match[0] });
      }
    }
  }
  
  return episodes.sort((a, b) => a.number - b.number);
}

/**
 * Get video servers for a specific episode using API logic
 */
export async function getJKAnimeServers(slug: string, episode: number): Promise<JKAnimeServer[]> {
  const url = `${BASE_URL}/${slug}/${episode}/`;
  const html = await readPage(url);
  
  const servers: JKAnimeServer[] = [];
  
  // 1. Extract from 'var servers = [...]' (Base64 encoded)
  const serversRegex = /var servers = (\[[\s\S]*?\]);/;
  const serversMatch = serversRegex.exec(html);
  
  if (serversMatch) {
    try {
      const rawServers = JSON.parse(serversMatch[1]);
      for (const s of rawServers) {
        if (s.remote) {
          // Decode Base64 from remote field
          let decodedUrl = s.remote;
          try {
             // Check if it looks like base64
             if (!s.remote.startsWith('http')) {
               decodedUrl = Buffer.from(s.remote, 'base64').toString('utf-8');
             }
          } catch (e) {
             console.warn("Failed to decode base64, using raw:", s.remote);
          }
          
          // Extract src if it's an iframe
          const srcMatch = /src="([^"]+)"/.exec(decodedUrl);
          const finalUrl = srcMatch ? srcMatch[1] : decodedUrl;

          servers.push({
            name: s.server || "Unknown",
            remote: finalUrl
          });
        }
      }
    } catch (e) {
      console.error("Error parsing JKAnime servers:", e);
    }
  }
  
  // 2. Fallback: Extract from 'video[X] = "<iframe>"'
  const videoRegex = /video\[(\d+)\]\s*=\s*(['"])([\s\S]*?)\2/g;
  let vMatch;
  while ((vMatch = videoRegex.exec(html)) !== null) {
    const iframeHtml = vMatch[3];
    const srcMatch = /src="([^"]+)"/.exec(iframeHtml);
    if (srcMatch) {
      const remote = srcMatch[1];
      if (!servers.some(s => s.remote === remote)) {
        let name = "Unknown";
        if (remote.includes("nozo")) name = "Nozomi";
        else if (remote.includes("mixdrop")) name = "MixDrop";
        else if (remote.includes("ok.ru")) name = "Okru";
        servers.push({ name, remote });
      }
    }
  }
  
  return servers;
}
