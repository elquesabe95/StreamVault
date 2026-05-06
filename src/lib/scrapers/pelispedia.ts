import ZAI from "z-ai-web-dev-sdk";
import { extractAttribute } from "./utils";

const BASE_URL = "https://pelispedia.mov";

export interface PelispediaResult {
  title: string;
  url: string;
  image?: string;
  year?: string;
  type: "movie" | "tv";
}

export interface VideoSource {
  server: string;
  url: string;
  lang: "latino" | "espanol" | "subtitulado";
}

async function readPage(url: string): Promise<string> {
  const zai = await ZAI.create();
  const result = await zai.functions.invoke("page_reader", { url });
  return result.data.html || "";
}

/**
 * Search for movies or series on Pelispedia
 */
export async function searchPelispedia(query: string): Promise<PelispediaResult[]> {
  const searchUrl = `${BASE_URL}/search?s=${encodeURIComponent(query)}`;
  const html = await readPage(searchUrl);
  
  const results: PelispediaResult[] = [];
  
  // Extract results using regex
  // Looking for <article> blocks in search results
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/g;
  let match;
  
  while ((match = articleRegex.exec(html)) !== null) {
    const content = match[1];
    
    const urlMatch = /href="([^"]+)"/.exec(content);
    const titleMatch = /class="title"[^>]*>([^<]+)<\/h2>/.exec(content);
    const imgMatch = /src="([^"]+)"/.exec(content);
    
    if (urlMatch && titleMatch) {
      results.push({
        title: titleMatch[1].trim(),
        url: urlMatch[1],
        image: imgMatch ? imgMatch[1] : undefined,
        type: urlMatch[1].includes("/pelicula/") ? "movie" : "tv"
      });
    }
  }
  
  return results;
}

/**
 * Extract video sources from a Pelispedia movie/episode page
 */
export async function getPelispediaSources(url: string): Promise<VideoSource[]> {
  const html = await readPage(url);
  const sources: VideoSource[] = [];
  
  // Pelispedia stores server links in a specific container or script
  // Looking for server buttons/links
  // Example pattern based on typical WordPress movie themes:
  // <li class="dooplay_player_option" data-type="movie" data-post="123" data-nume="1">
  
  const serverOptionRegex = /<li[^>]*class="[^"]*dooplay_player_option[^"]*"[^>]*data-type="([^"]*)"[^>]*data-post="([^"]*)"[^>]*data-nume="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g;
  let match;
  
  while ((match = serverOptionRegex.exec(html)) !== null) {
    const [_, type, postId, nume, content] = match;
    
    // Extract server name and language
    const serverNameMatch = /<span class="title">([^<]+)<\/span>/.exec(content);
    const langMatch = /<span class="server">([^<]+)<\/span>/.exec(content);
    
    const serverName = serverNameMatch ? serverNameMatch[1].trim() : "Unknown";
    const langRaw = langMatch ? langMatch[1].toLowerCase() : "";
    
    let lang: VideoSource["lang"] = "latino";
    if (langRaw.includes("lat") || langRaw.includes("mex")) lang = "latino";
    else if (langRaw.includes("esp")) lang = "espanol";
    else if (langRaw.includes("sub")) lang = "subtitulado";
    
    // The actual URL often requires an AJAX call or is an iframe link
    // For now, we'll extract the direct iframe if present or construct the embed URL
    const embedUrl = `${BASE_URL}/?player=${type}&post=${postId}&nume=${nume}`;
    
    sources.push({
      server: serverName,
      url: embedUrl,
      lang
    });
  }
  
  return sources;
}
