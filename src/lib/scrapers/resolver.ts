import { readPage } from "./client";

/**
 * Common regex patterns to extract direct streams from embed players
 * Handles HLS (m3u8), MP4 and common obfuscation patterns
 */
const M3U8_REGEX = /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/;
const SOURCES_REGEX = /sources\s*:\s*\[\s*{\s*file\s*:\s*["']([^"']+)['"]/;
const PACKED_REGEX = /eval\(function\(p,a,c,k,e,d\).+?["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/;

// Returns a fresh regex each call to avoid stateful lastIndex issues with /g flag
function videoHostRegex() {
  return /https?:\/\/(?:streamwish|filemoon|vidhide|streamtape|dood(?:stream)?|voe|waaw|upstream|wishembed|awish|embedrise|mixdrop|mp4upload)\.[a-z]+\/[^\s"'<>]+/g;
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

/**
 * Basic unpacker for Dean Edwards' P.A.C.K.E.R.
 */
function unpack(code: string): string {
    let p = "", a = 0, c = 0, k: string[] = [];
    const match = /eval\(function\(p,a,c,k,e,d\).*?return p}\('(.*?)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/.exec(code);
    if (!match) return code;
    
    p = match[1]; a = parseInt(match[2]); c = parseInt(match[3]); k = match[4].split('|');
    
    while (c--) {
        if (k[c]) {
            const regex = new RegExp('\\b' + c.toString(a > 36 ? 36 : a) + '\\b', 'g');
            p = p.replace(regex, k[c]);
        }
    }
    return p;
}

/**
 * Resolves a common embed URL to a direct stream or a list of server URLs
 */
export async function resolveStream(url: string): Promise<string | string[]> {
  if (url.includes(".m3u8") || url.includes(".mp4")) return url;

  console.log(`[Resolver] Resolving: ${url}`);

  try {
    const html = await readPage(url);
    
    // 1. Host-specific decoders
    
    // --- Streamtape ---
    if (url.includes("streamtape.com") || url.includes("stape")) {
        const linkMatch = /id=["']robotlink["'][^>]*>([^<]+)/.exec(html);
        if (linkMatch) {
            let robotLink = linkMatch[1];
            const partMatch = /document\.getElementById\(['"]robotlink['"]\)\.innerHTML\s*\+=\s*['"]([^'"]+)['"]/.exec(html);
            if (partMatch) {
                robotLink += partMatch[1];
            }
            if (!robotLink.startsWith("http")) robotLink = "https:" + robotLink;
            return robotLink;
        }
    }

    // --- Doodstream ---
    if (url.includes("dood") || url.includes("ds2play")) {
        const passMatch = /\/pass_md5\/([^'"]+)/.exec(html);
        if (passMatch) {
            const passUrl = `https://dood.to/pass_md5/${passMatch[1]}`;
            // This would normally need a second fetch, but we can try to find the token in the same page
            const tokenMatch = /token=([^&"']+)/.exec(html);
            if (tokenMatch) {
                return `${passUrl}?token=${tokenMatch[1]}`;
            }
        }
    }

    // --- Voe.sx ---
    if (url.includes("voe.sx")) {
        const base64Match = /["'](h[a-zA-Z0-9+/=]{20,})["']/.exec(html);
        if (base64Match) {
            try {
                const decoded = Buffer.from(base64Match[1], 'base64').toString();
                if (decoded.includes(".m3u8")) return decoded;
            } catch (e) {}
        }
        const directMatch = /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/.exec(html);
        if (directMatch) return directMatch[1];
    }

    // --- Filemoon / Streamwish / Vidhide ---
    if (html.includes("eval(function(p,a,c,k,e,d)")) {
        const packedMatch = /eval\(function\(p,a,c,k,e,d\).*?split\('\|'\)\)\)/.exec(html);
        if (packedMatch) {
            const unpacked = unpack(packedMatch[0]);
            const unpackedM3u8 = /["'](https?:\/\/[^"'\s<>]+?\.m3u8[^"'\s<>]*)["']/.exec(unpacked);
            if (unpackedM3u8) {
                console.log(`[Resolver] Found m3u8 in unpacked script: ${unpackedM3u8[1]}`);
                return unpackedM3u8[1];
            }
        }
    }

    // --- Master Embeds (Embed69, Moe, etc.) ---
    if (url.includes("embed69") || url.includes("apialfa") || url.includes("superembed")) {
        const dataLinkMatch = /let\s+dataLink\s*=\s*(\[[\s\S]*?\]);/.exec(html);
        if (dataLinkMatch) {
            try {
                const dataLink = JSON.parse(dataLinkMatch[1]);
                const jwtLinks = dataLink.flatMap((file: any) =>
                    Array.isArray(file.sortedEmbeds)
                        ? file.sortedEmbeds.map((embed: any) => decodeJwtLink(embed.link)).filter(Boolean)
                        : []
                );
                if (jwtLinks.length > 0) {
                    console.log(`[Resolver] Extracted ${jwtLinks.length} JWT servers from Master Iframe`);
                    return [...new Set(jwtLinks)] as string[];
                }
            } catch (e) {
                console.warn("[Resolver] Failed to parse Master Iframe dataLink", e);
            }
        }

        // Look for common server patterns in JavaScript arrays or buttons
        const serversRegex = /["'](?:link|url|remote)["']\s*:\s*["'](https?:\/\/[^"']+)["']/g;
        const found = [...html.matchAll(serversRegex)].map(m => m[1]);
        if (found.length > 0) {
            console.log(`[Resolver] Extracted ${found.length} servers from Master Iframe`);
            return found;
        }
        
        // Fallback: look for ANY video host link in the HTML
        const hosts = [...html.matchAll(videoHostRegex())].map(m => m[0]);
        if (hosts.length > 0) return [...new Set(hosts)];
    }

    // 3. Aggressive scan for .m3u8 or .mp4 URLs
    const aggressiveM3u8 = /["'](https?:\/\/[^"'\s<>]+?\.m3u8[^"'\s<>]*)["']/.exec(html);
    if (aggressiveM3u8) {
        return aggressiveM3u8[1];
    }
    
    const aggressiveMp4 = /["'](https?:\/\/[^"'\s<>]+?\.mp4[^"'\s<>]*)["']/.exec(html);
    if (aggressiveMp4) {
        return aggressiveMp4[1];
    }

    // 4. Ultra-Aggressive .m3u8 scan (anywhere in HTML)
    const allM3u8 = html.match(/https?:\/\/[^"'\s<>]+?\.m3u8[^"'\s<>]*/g);
    if (allM3u8) {
        const filtered = allM3u8.filter(link => !link.includes('google') && !link.includes('cloudflare'));
        if (filtered.length > 0) return filtered[0];
    }

    // 5. Generic fallback (iframes)
    const genericUrls = [...html.matchAll(videoHostRegex())].map(m => m[0]);
    const uniqueGeneric = [...new Set(genericUrls)];
    
    if (uniqueGeneric.length > 0) {
        // If we found specific host links inside a generic page, return only the specific ones
        return uniqueGeneric;
    }

  } catch (e) {
    console.error(`[Resolver] Error for ${url}:`, e);
  }

  return url;
}
