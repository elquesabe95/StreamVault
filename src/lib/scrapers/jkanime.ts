import ZAI from "z-ai-web-dev-sdk";

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

async function readPage(url: string): Promise<string> {
  const zai = await ZAI.create();
  const result = await zai.functions.invoke("page_reader", { url });
  return result.data.html || "";
}

/**
 * Search for anime on JKAnime
 */
export async function searchJKAnime(query: string): Promise<JKAnimeResult[]> {
  const searchUrl = `${BASE_URL}/buscar/${encodeURIComponent(query).replace(/%20/g, "_")}/1/`;
  const html = await readPage(searchUrl);
  
  const results: JKAnimeResult[] = [];
  const animeRegex = /<div class="anime__item">([\s\S]*?)<\/div><\/div><\/div>/g;
  let match;
  
  while ((match = animeRegex.exec(html)) !== null) {
    const content = match[1];
    
    const urlMatch = /href="https:\/\/jkanime\.net\/([^/]+)\/"/.exec(content);
    const titleMatch = /<h5><a[^>]*>([^<]+)<\/a><\/h5>/.exec(content);
    const imgMatch = /data-setbg="([^"]+)"/.exec(content);
    
    if (urlMatch && titleMatch) {
      results.push({
        title: titleMatch[1].trim(),
        slug: urlMatch[1],
        image: imgMatch ? imgMatch[1] : "",
        type: "anime"
      });
    }
  }
  
  return results;
}

/**
 * Get all episodes for an anime
 */
export async function getJKAnimeEpisodes(slug: string): Promise<JKAnimeEpisode[]> {
  const url = `${BASE_URL}/${slug}/`;
  const html = await readPage(url);
  
  const episodes: JKAnimeEpisode[] = [];
  
  // JKAnime lists episodes in a script or a specific div
  // Usually they use a pagination/list
  const epRegex = /href="https:\/\/jkanime\.net\/([^/]+)\/(\d+)\/"/g;
  let match;
  const seen = new Set<number>();
  
  while ((match = epRegex.exec(html)) !== null) {
    const epNum = parseInt(match[2]);
    if (!seen.has(epNum)) {
      seen.add(epNum);
      episodes.push({
        number: epNum,
        url: match[0]
      });
    }
  }
  
  return episodes.sort((a, b) => a.number - b.number);
}

/**
 * Get video servers for a specific episode
 */
export async function getJKAnimeServers(slug: string, episode: number): Promise<JKAnimeServer[]> {
  const url = `${BASE_URL}/${slug}/${episode}/`;
  const html = await readPage(url);
  
  const servers: JKAnimeServer[] = [];
  
  // Servers are usually defined in a script: var video = []; video[1] = '<iframe...';
  const serverRegex = /video\[(\d+)\]\s*=\s*'<iframe[^>]+src="([^"]+)"/g;
  let match;
  
  while ((match = serverRegex.exec(html)) !== null) {
    let remote = match[2];
    
    // Determine server name from URL
    let name = "Unknown";
    if (remote.includes("nozo")) name = "Nozomi";
    else if (remote.includes("mixdrop")) name = "MixDrop";
    else if (remote.includes("ok.ru")) name = "Okru";
    else if (remote.includes("fembed")) name = "Fembed";
    else if (remote.includes("stape")) name = "Streamtape";
    
    servers.push({ name, remote });
  }
  
  return servers;
}
