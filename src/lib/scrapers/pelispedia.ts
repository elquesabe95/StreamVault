import { readPage } from "./client";

// Force module recompilation - v2
export const PELISPEDIA_VERSION = 2;

const BASE_URL = "https://pelispedia.mov";

export interface PelisSource {
  server: string;
  url: string;
  lang: "latino" | "spanish" | "subbed";
}

function decodeJwtLink(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    const data = JSON.parse(decoded);
    return typeof data.link === "string" ? data.link : null;
  } catch {
    return null;
  }
}

export async function searchPelispedia(query: string) {
  // Use the correct search pattern: /search?s=query
  const searchUrl = `${BASE_URL}/search?s=${encodeURIComponent(query)}`;
  const html = await readPage(searchUrl, {}, true);
  
  const results: { title: string; url: string; poster?: string }[] = [];
  
  // Robust regex that doesn't break on nested divs
  const itemRegex = /movie-card[\s\S]*?href=["']([^"']+)["'][\s\S]*?<h4[^>]*>([^<]+)<\/h4>/g;
  let match;
  
  while ((match = itemRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2];
    
    if (url && title) {
      results.push({
        title: title.trim(),
        url: url.startsWith("http") ? url : `${BASE_URL}${url}`
      });
    }
  }
  
  return results;
}

/**
 * Extract video sources from a PelisPedia page
 */
export async function getPelispediaSources(pageUrl: string): Promise<PelisSource[]> {
  const html = await readPage(pageUrl, {}, true);
  const sources: PelisSource[] = [];
  
  // 1. Extract server names from buttons (try multiple patterns)
  const serverNames: string[] = [];
  const serverBtnRegex = /<button[^>]+class="[^"]*server[^"]*"[^>]*>([\s\S]*?)<\/button>/gi;
  let sMatch;
  while ((sMatch = serverBtnRegex.exec(html)) !== null) {
    const text = sMatch[1].replace(/<[^>]+>/g, '').trim();
    if (text) serverNames.push(text);
  }

  // 2. Extract iframes from player divs
  const playerDivRegex = /<div[^>]+id="player-(\d+)"[^>]*>[\s\S]*?<iframe[^>]+src=["']([^"']+)["']/g;
  let pMatch;
  
  while ((pMatch = playerDivRegex.exec(html)) !== null) {
    const index = parseInt(pMatch[1]);
    let url = pMatch[2];
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("/")) url = BASE_URL + url;
    
    // Skip non-video resources
    if (url.includes('.js') || url.includes('cloudflare') || url.includes('google') || url.includes('.css') || url.includes('youtube.com') || url.includes('youtu.be')) continue;
    
    sources.push({
      server: serverNames[index] || `Servidor ${index + 1}`,
      url: url,
      lang: "latino"
    });
  }
  
  // 3. Fallback: catch any remaining iframes with video-like URLs
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let iMatch;
  while ((iMatch = iframeRegex.exec(html)) !== null) {
    let url = iMatch[1];
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("/")) url = BASE_URL + url;
    if (url.includes('.js') || url.includes('cloudflare') || url.includes('google') || url.includes('youtube.com') || url.includes('youtu.be')) continue;
    
    // If it's a known multi-server host, we'll handle it in the resolver
    sources.push({
      server: "Multi-Server",
      url: url,
      lang: "latino"
    });
  }

  // 4. Extract JWT dataLink directly from the page (bypasses embed69)
  const dlRegex = /(?:let|const|var)\s+dataLink\s*=\s*(\[[\s\S]*?\]|\{[\s\S]*\});/;
  const dataLinkMatch = dlRegex.exec(html);
  if (dataLinkMatch) {
    try {
      const parsed = JSON.parse(dataLinkMatch[1]);
      let embeds: any[] = [];
      if (parsed.data?.embeds) {
        embeds = parsed.data.embeds;
      } else if (Array.isArray(parsed)) {
        for (const file of parsed) {
          embeds.push(...(file.sortedEmbeds || file.embeds || []));
        }
      }
      for (const embed of embeds) {
        const link = decodeJwtLink(embed.link || embed.url || "");
        if (link) {
          sources.push({ server: "JWT", url: link, lang: "latino" });
        }
      }
    } catch {}
  } else {
    // Try bracket extraction
    const idx = html.indexOf('dataLink');
    if (idx >= 0) {
      const bracketStart = html.indexOf('[', idx);
      if (bracketStart >= 0) {
        let depth = 0, endIdx = -1;
        for (let i = bracketStart; i < html.length; i++) {
          if (html[i] === '[') depth++;
          else if (html[i] === ']') depth--;
          if (depth === 0) { endIdx = i; break; }
        }
        if (endIdx >= 0) {
          try {
            const bracketData = JSON.parse(html.substring(bracketStart, endIdx + 1));
            const jwtLinks: string[] = [];
            for (const file of bracketData) {
              const embeds = file.sortedEmbeds || file.embeds || [];
              for (const embed of embeds) {
                const link = decodeJwtLink(embed.link || embed.url || "");
                if (link) jwtLinks.push(link);
              }
            }
            for (const link of jwtLinks) {
              sources.push({ server: "JWT-Stream", url: link, lang: "latino" });
            }
          } catch {}
        }
      }
    }
  }
  
  // Filter out known dead hosts
  const deadHosts = /minochinos|earnvids|short\.icu/i;
  const filtered = sources.filter(s => !deadHosts.test(s.url));

  // Expand vidurl internal player pages
  const expanded: PelisSource[] = [];
  for (const s of filtered) {
    if (s.url.includes("pelispedia.mov/vidurl/")) {
      console.log(`[PelisPedia] Following vidurl: ${s.url}`);
      const vidHtml = await readPage(s.url, {}, true);
      let vidCount = 0;

      if (vidHtml && vidHtml.length > 500) {
        const seen = new Set<string>();

        // Extract dataLink JSON and decode JWT tokens
        const dlRegex = /dataLink\s*=\s*(\[[\s\S]*?\]);/;
        const dlMatch = dlRegex.exec(vidHtml);
        if (dlMatch) {
          try {
            const parsed = JSON.parse(dlMatch[1]);
            for (const file of parsed) {
              const embeds = file.sortedEmbeds || file.embeds || [];
              for (const embed of embeds) {
                const link = decodeJwtLink(embed.link || embed.url || "");
                if (link && !seen.has(link)) {
                  seen.add(link);
                  vidCount++;
                  expanded.push({ 
                    server: embed.servername || `Servidor ${vidCount}`, 
                    url: link, 
                    lang: file.video_language === "LAT" ? "latino" : file.video_language === "ESP" ? "spanish" : "subbed"
                  });
                }
              }
            }
            console.log(`[PelisPedia] Vidurl JWT: ${vidCount} servers decoded`);
          } catch (e) {
            console.warn(`[PelisPedia] Vidurl JWT parse failed:`, (e as Error).message);
          }
        }

        console.log(`[PelisPedia] Vidurl expanded to ${vidCount} servers`);
      }
      
      if (vidCount === 0) {
        // Fallback: keep original vidurl
        expanded.push(s);
      }
    } else {
      expanded.push(s);
    }
  }

  return expanded;
}

/**
 * Get the episode URL from a series page
 */
export async function getPelispediaEpisodeUrl(seriesUrl: string, season: number, episode: number): Promise<string | null> {
  try {
    const html = await readPage(seriesUrl, {}, true);
    
    // Primary pattern: /serie/slug/temporada/S/capitulo/E (confirmed from live site)
    const primaryPattern = new RegExp(`/serie/[^"]+/temporada/${season}/capitulo/${episode}[^"]*`, 'i');
    const primaryMatch = primaryPattern.exec(html);
    if (primaryMatch) {
      return `${BASE_URL}${primaryMatch[0]}`;
    }
    
    // Secondary patterns used by some sites
    const searchPatterns = [
      `-${season}x${episode}`,
      `season-${season}-episode-${episode}`,
      `temporada-${season}-episodio-${episode}`,
    ];
    
    const linksRegex = /href="([^"]+)"/g;
    let match;
    while ((match = linksRegex.exec(html)) !== null) {
      const url = match[1];
      for (const pattern of searchPatterns) {
        if (url.includes(pattern)) {
          return url.startsWith("http") ? url : `${BASE_URL}${url}`;
        }
      }
    }
    
    // No guessing.
  } catch (e) {
    console.error("Pelispedia episode fetch failed:", e);
  }
  return null;
}
