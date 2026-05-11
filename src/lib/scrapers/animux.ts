import { readPage, readJson } from "./client";
import fs from "fs";
import path from "path";

const BASE_URL = "https://animux.site";
const IS_RENDER = process.env.RENDER === "true" || !!process.env.RENDER_EXTERNAL_URL;
const CACHE_FILE = IS_RENDER 
  ? path.join("/tmp", "animux-channels.json")
  : path.join(process.cwd(), "src/lib/scrapers/animux-channels.json");

export interface AnimuxChannel {
  id: string;
  name: string;
  category: string;
  url: string;
  logo?: string;
}

function normalizeCategory(category?: string): string {
  if (!category) return "General";
  const value = category.toLowerCase().trim();
  const map: Record<string, string> = {
    sports: "Deportes",
    sport: "Deportes",
    news: "Noticias",
    entertainment: "Entretenimiento",
    movies: "Cine",
    movie: "Cine",
    music: "Musica",
    kids: "Infantil",
    children: "Infantil",
    documentary: "Documentales",
    documentaries: "Documentales",
    religious: "Religioso",
    religion: "Religioso",
    education: "Educacion",
    educational: "Educacion",
    comedy: "Comedia",
    drama: "Drama",
    general: "General",
    culture: "Cultura",
    series: "Series",
    nacionales: "Nacionales",
    "tv abierta": "Nacionales",
  };

  return map[value] || category.split(";")[0].trim() || "General";
}

function toAnimuxChannel(raw: any, fallbackCategory = "General"): AnimuxChannel | null {
  const name = raw.name || raw.displayName || raw.title;
  const url = raw.url || raw.stream || raw.src || raw.link;
  if (!name || !url || raw.isVOD) return null;

  return {
    id: String(raw.id || raw.name || raw.title || url),
    name: String(name),
    category: normalizeCategory(raw.category || fallbackCategory),
    url: String(url),
    logo: raw.logo || raw.img || raw.image || raw.poster,
  };
}

/**
 * Get all available channels from Animux
 * Using the official channels.json and nacionales.json endpoints
 */
export async function getAnimuxChannels(): Promise<AnimuxChannel[]> {
  // 1. Try local cache first (fast, no network)
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const stats = fs.statSync(CACHE_FILE);
      const mtime = stats.mtime.getTime();
      const now = new Date().getTime();
      // Cache for 1 hour
      if (now - mtime < 3600000) {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
        if (Array.isArray(cached) && cached.length > 0) {
          console.log(`[Animux] Loaded ${cached.length} channels from local cache`);
          return cached;
        }
      }
    }
  } catch (e) {
    console.warn("[Animux] Cache read failed:", e);
  }

  const allChannels: AnimuxChannel[] = [];
  const seenIds = new Set<string>();

  const addChannel = (channel: AnimuxChannel | null) => {
    if (!channel) return;
    const dedupeKey = `${channel.name.toLowerCase().trim()}|${channel.url.trim()}`;
    if (seenIds.has(dedupeKey)) return;
    seenIds.add(dedupeKey);
    allChannels.push(channel);
  };

  // 2. Fetch from JSON endpoints
  const endpoints = [
    "https://animux.site/channels.json",
    "https://animux.site/nacionales.json",
    "https://animux.site/api/channels"
  ];

  for (const url of endpoints) {
    try {
      console.log(`[Animux] Fetching from ${url}...`);
      const data = await readJson(url);
      if (Array.isArray(data)) {
        data.forEach(item => addChannel(toAnimuxChannel(item)));
      } else if (data && typeof data === "object") {
        // Handle cases where data might be { channels: [...] }
        const channels = (data as any).channels || (data as any).streams || [];
        if (Array.isArray(channels)) {
          channels.forEach((item: any) => addChannel(toAnimuxChannel(item)));
        }
      }
    } catch (e) {
      console.warn(`[Animux] Failed to fetch from ${url}:`, e);
    }
  }

  // If we got channels, save to cache
  if (allChannels.length > 0) {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(allChannels, null, 2));
      console.log(`[Animux] Saved ${allChannels.length} channels to cache`);
    } catch (e) {
      console.warn("[Animux] Failed to save cache:", e);
    }
  }

  return allChannels.sort((a, b) => {
    const cat = a.category.localeCompare(b.category);
    if (cat !== 0) return cat;
    return a.name.localeCompare(b.name);
  });
}


/**
 * Get the direct stream URL for an Animux channel
 */
export async function getAnimuxStream(channelUrl: string): Promise<string> {
  // If it's already an m3u8, return it
  if (channelUrl.includes(".m3u8")) return channelUrl;
  
  console.log(`[Animux] Resolving stream for: ${channelUrl}`);
  const html = await readPage(channelUrl, {}, true);
  
  // Look for the stream URL in the HTML or scripts
  // Patterns: 
  // "src": "http://.../index.m3u8"
  // var stream = "http://.../index.m3u8"
  const streamRegex = /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/;
  const match = streamRegex.exec(html);
  
  if (match) {
    console.log(`[Animux] Found m3u8 in HTML: ${match[1]}`);
    return match[1];
  }

  // Check for specific RCN/Nacional patterns in the HTML or scripts
  if (html.includes("rcnmas") || html.includes("wurl.tv")) {
    const rcnMatch = /["'](https?:\/\/[^"']+wurl\.tv[^"']+\.m3u8[^"']*)["']/.exec(html);
    if (rcnMatch) return rcnMatch[1];
  }

  if (html.includes("jmp2.uk")) {
    const jmpMatch = /["'](https?:\/\/jmp2\.uk[^"']+\.m3u8[^"']*)["']/.exec(html);
    if (jmpMatch) return jmpMatch[1];
  }

  // Look for iframe
  const iframeRegex = /<iframe[^>]+src="([^"]+)"/;
  const iframeMatch = iframeRegex.exec(html);
  
  if (iframeMatch) {
    const iframeUrl = iframeMatch[1];
    console.log(`[Animux] Found iframe: ${iframeUrl}`);
    // If the iframe is already an m3u8 (unlikely but possible)
    if (iframeUrl.includes(".m3u8")) return iframeUrl;
    
    // Handle proxy patterns
    if (iframeUrl.includes("/play/")) {
      const idMatch = /\/play\/([^/?]+)/.exec(iframeUrl);
      if (idMatch) {
        const id = idMatch[1];
        // Some IDs are simple like 'a0b0', others are complex
        const proxyUrl = `http://181.78.8.199:8000/play/${id}/index.m3u8`;
        console.log(`[Animux] Using proxy URL: ${proxyUrl}`);
        return proxyUrl;
      }
    }

    if (iframeUrl.includes("jmp2.uk")) return iframeUrl;
    
    return iframeUrl;
  }

  // Last ditch effort: search for anything that looks like an HLS stream
  const scriptRegex = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g;
  const scriptMatches = html.match(scriptRegex);
  if (scriptMatches && scriptMatches.length > 0) {
    // Prefer non-advertisement/tracking streams
    const cleanMatch = scriptMatches.find(m => !m.includes("ads") && !m.includes("log"));
    const finalMatch = cleanMatch || scriptMatches[0];
    console.log(`[Animux] Found m3u8 in scripts: ${finalMatch}`);
    return finalMatch;
  }
  
  return channelUrl;
}

