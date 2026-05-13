/**
 * Client-side JWT resolver for embed69 URLs.
 * Uses public CORS proxies to fetch embed69 pages from the browser.
 */

function decodeJwtLink(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const data = JSON.parse(decoded);
    return typeof data.link === "string" ? data.link : null;
  } catch {
    return null;
  }
}

function extractJwtFromHtml(html: string): string[] {
  const links: string[] = [];

  // Try bracket parser
  const idx = html.indexOf("dataLink");
  if (idx >= 0) {
    const bracketStart = html.indexOf("[", idx);
    if (bracketStart >= 0) {
      let depth = 0;
      let endIdx = -1;
      for (let i = bracketStart; i < html.length; i++) {
        if (html[i] === "[") depth++;
        else if (html[i] === "]") depth--;
        if (depth === 0) { endIdx = i; break; }
      }
      if (endIdx >= 0) {
        try {
          const bracketData = JSON.parse(html.substring(bracketStart, endIdx + 1));
          for (const file of bracketData) {
            const embeds = file.sortedEmbeds || file.embeds || [];
            for (const embed of embeds) {
              const link = decodeJwtLink(embed.link || embed.url || "");
              if (link) links.push(link);
            }
          }
        } catch {}
      }
    }
  }

  // Try regex: let/const/var dataLink = [...];
  if (links.length === 0) {
    const dlRegex = /(?:let|const|var)\s+dataLink\s*=\s*(\[[\s\S]*?\]|\{[\s\S]*\});/;
    const dlMatch = dlRegex.exec(html);
    if (dlMatch) {
      try {
        const parsed = JSON.parse(dlMatch[1]);
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
          if (link) links.push(link);
        }
      } catch {}
    }
  }

  return [...new Set(links)];
}

const CORS_PROXIES = [
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
];

export async function resolveEmbed69Client(url: string): Promise<string[]> {
  const encoded = encodeURIComponent(url);
  
  for (const proxy of CORS_PROXIES) {
    try {
      console.log(`[JWT-Client] Trying ${proxy.split("?")[0]}...`);
      const res = await fetch(`${proxy}${encoded}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn(`[JWT-Client] ${proxy.split("?")[0]} status ${res.status}`);
        continue;
      }
      const html = await res.text();
      console.log(`[JWT-Client] ${proxy.split("?")[0]} returned ${html.length} bytes`);
      if (html.length < 1000) {
        console.warn(`[JWT-Client] Response too short (${html.length}b), likely blocked`);
        continue;
      }
      
      const links = extractJwtFromHtml(html);
      if (links.length > 0) {
        console.log(`[JWT-Client] Resolved ${links.length} streams from ${url}`);
        return links;
      }
      console.warn(`[JWT-Client] No JWT found in ${html.length}b response`);
    } catch (e) {
      console.warn(`[JWT-Client] ${proxy.split("?")[0]} failed:`, (e as Error).message);
    }
  }
  
  console.warn(`[JWT-Client] All proxies failed for ${url}`);
  return [];
}
