import { readPage } from "./client";

const BASE_URL = "https://www3.animeflv.net";

export interface AnimeFLVSource {
  server: string;
  url: string;
}

/**
 * Search for anime on AnimeFLV
 */
export async function searchAnimeFLV(query: string) {
  const searchUrl = `${BASE_URL}/browse?q=${encodeURIComponent(query)}`;
  const html = await readPage(searchUrl);
  
  const results: { title: string; url: string; poster?: string }[] = [];
  
  // Pattern: <article class="Anime alt B"> <a href="..."> <div class="Image"> <img src="..."> </div> <h3 class="Title">...</h3> </article>
  const itemRegex = /<article[^>]+class="Anime[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let match;
  
  while ((match = itemRegex.exec(html)) !== null) {
    const content = match[1];
    const urlMatch = /href="([^"]+)"/.exec(content);
    const titleMatch = /<h3[^>]+class="Title"[^>]*>([^<]+)<\/h3>/.exec(content);
    const posterMatch = /src="([^"]+)"/.exec(content);
    
    if (urlMatch && titleMatch) {
      results.push({
        title: titleMatch[1].trim(),
        url: urlMatch[1].startsWith("http") ? urlMatch[1] : `${BASE_URL}${urlMatch[1]}`,
        poster: posterMatch ? posterMatch[1] : undefined
      });
    }
  }
  
  return results;
}

/**
 * Extract episodes and sources from AnimeFLV
 * This involves finding the scripts that contain the video links
 */
export async function getAnimeFLVServers(animeUrl: string, episode: number): Promise<AnimeFLVSource[]> {
  // 1. Get the anime page to find the episode list
  // Note: AnimeFLV uses slugs for episodes like /ver/anime-slug-episode
  const animeSlug = animeUrl.split("/").pop();
  const epUrl = `${BASE_URL}/ver/${animeSlug}-${episode}`;
  
  const html = await readPage(epUrl);
  const servers: AnimeFLVSource[] = [];
  
  // Look for the 'videos' variable in the script tag
  // Pattern: var videos = {"SUB":[...], "LAT":[...]};
  const videosRegex = /var\s+videos\s*=\s*({[\s\S]*?});/;
  const match = videosRegex.exec(html);
  
  if (match) {
    try {
      const data = JSON.parse(match[1]);
      const subSources = data.SUB || [];
      const latSources = data.LAT || [];
      
      subSources.forEach((s: any) => {
        servers.push({
          server: `${s.server || s.title} (Sub)`,
          url: s.code || s.url
        });
      });

      latSources.forEach((s: any) => {
        servers.push({
          server: `${s.server || s.title} (Latino)`,
          url: s.code || s.url
        });
      });
    } catch (e) {}
  }
  
  return servers;
}
