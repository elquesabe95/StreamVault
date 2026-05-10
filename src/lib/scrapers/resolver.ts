import { readPage } from "./client";

function videoHostRegex() {
  return /https?:\/\/(?:streamwish|filemoon|vidhide|streamtape|dood(?:stream)?|voe|waaw|upstream|wishembed|awish|embedrise|mixdrop|mp4upload|closeload|embedsito|uqload|wolfstream|speedostream|vidcloud|vidnode|vidplay|vidsrc)\.[a-z]+\/[^\s"'<>]+/g;
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

function unpack(code: string): string {
  let p = "", a = 0, c = 0, k: string[] = [];

  // Standard P.A.C.K.E.R.
  let match = /eval\(function\(p,a,c,k,e,d\).*?return p}\('(.*?)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/.exec(code);
  if (!match) {
    // Try alternate pattern
    match = /eval\(function\(p,a,c,k,e,d\).*?return p}\('(.*?)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/.exec(code);
  }
  if (!match) return code;

  p = match[1]; a = parseInt(match[2]); c = parseInt(match[3]); k = match[4].split('|');

  while (c--) {
    if (k[c]) {
      const regex = new RegExp('\\b' + c.toString(a > 36 ? 36 : a) + '\\b', 'g');
      p = p.replace(regex, k[c]);
    }
  }

  // If still packed, try again
  if (/eval\(function\(p,a,c,k,e,d\)/.test(p)) {
    try {
      return unpack(p);
    } catch {}
  }

  return p;
}

function findM3u8InText(text: string): string | null {
  // Multiple patterns for finding HLS streams
  const patterns = [
    // Direct m3u8 URL in quotes
    /["'](https?:\/\/[^"'\s<>]+?\.m3u8[^"'\s<>]*)["']/,
    // file: "url" in JS objects
    /file\s*:\s*["'](https?:\/\/[^"']+)["']/,
    // source: "url"
    /source\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/,
    // src: "url"
    /src\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/,
    // Any m3u8 in the text
    /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/,
  ];

  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m) return m[1];
  }

  return null;
}

/**
 * O(n) bracket parser for extracting dataLink array from embed69-style pages.
 * Much faster than catastrophic backtracking regex.
 */
function extractDataLinkBrackets(html: string): any[] | null {
  const idx = html.indexOf('dataLink');
  if (idx < 0) return null;

  const bracketStart = html.indexOf('[', idx);
  if (bracketStart < 0) return null;

  let depth = 0;
  let endIdx = -1;
  for (let i = bracketStart; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') depth--;
    if (depth === 0) { endIdx = i; break; }
  }

  if (endIdx < 0) return null;

  try {
    const jsonStr = html.substring(bracketStart, endIdx + 1);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function findMp4InText(text: string): string | null {
  const patterns = [
    /["'](https?:\/\/[^"'\s<>]+?\.mp4[^"'\s<>]*)["']/,
    /file\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/,
    /src\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/,
    /(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/,
  ];

  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m) return m[1];
  }

  return null;
}

function tryDecodeBase64Urls(html: string): string | null {
  // Look for base64-encoded hls/mp4 URLs in script tags
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  const b64Pattern = /["']([A-Za-z0-9+/=]{40,})["']/g;

  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const script = scriptMatch[1];
    let b64Match;
    while ((b64Match = b64Pattern.exec(script)) !== null) {
      try {
        const decoded = Buffer.from(b64Match[1], 'base64').toString('utf-8');
        const m3u8 = findM3u8InText(decoded);
        if (m3u8) return m3u8;
        const mp4 = findMp4InText(decoded);
        if (mp4) return mp4;
      } catch {}
    }
  }

  return null;
}

/**
 * Resolves an embed URL to a direct stream or list of server URLs
 */
export async function resolveStream(url: string): Promise<string | string[]> {
  if (url.includes(".m3u8") || url.includes(".mp4")) return url;

  console.log(`[Resolver] Resolving: ${url}`);

  try {
    // Send correct Referer for embed sites that check it
    const extraHeaders: Record<string, string> = {};
    if (url.includes("embed69.org")) extraHeaders["Referer"] = "https://pelispedia.mov/";
    const html = await readPage(url, extraHeaders);

    if (!html || html.length < 200) {
      console.warn(`[Resolver] Empty/short response for ${url}`);
      return url;
    }

    // ───────────────────────────────────────────
    // 1. Host-specific decoders
    // ───────────────────────────────────────────

    // --- Streamtape ---
    if (url.includes("streamtape.com") || url.includes("stape")) {
      const linkMatch = /id=["']robotlink["'][^>]*>([^<]+)/.exec(html);
      if (linkMatch) {
        let robotLink = linkMatch[1];
        const partMatch = /document\.getElementById\(['"]robotlink['"]\)\.innerHTML\s*\+=\s*['"]([^'"]+)['"]/.exec(html);
        if (partMatch) robotLink += partMatch[1];
        if (!robotLink.startsWith("http")) robotLink = "https:" + robotLink;
        console.log(`[Resolver] Streamtape resolved`);
        return robotLink;
      }
      // Alternative: look for norobotlink
      const norobot = /id=["']norobotlink["'][^>]*>([^<]+)/.exec(html);
      if (norobot) return "https:" + norobot[1];
    }

    // --- Doodstream ---
    if (url.includes("dood") || url.includes("ds2play")) {
      const passMatch = /\/pass_md5\/([^'"]+)/.exec(html);
      if (passMatch) {
        const tokenMatch = /[?&]token=([^&"'\s]+)/.exec(html);
        const passUrl = `https://dood.to/pass_md5/${passMatch[1]}`;
        if (tokenMatch) {
          console.log(`[Resolver] Doodstream resolved`);
          return `${passUrl}?token=${tokenMatch[1]}`;
        }
        // Try to get the /d/ page data
        const dMatch = /\/(d\/[a-zA-Z0-9]+)/.exec(html);
        if (dMatch) {
          // Might need second fetch but try extracting from current page
          const m3u8InPage = findM3u8InText(html);
          if (m3u8InPage) return m3u8InPage;
        }
      }
    }

    // --- Voe.sx ---
    if (url.includes("voe.sx") || url.includes("voe")) {
      // Try base64 encoded HLS
      const base64Match = /["']([a-zA-Z0-9+/=]{40,})["']/.exec(html);
      if (base64Match) {
        try {
          const decoded = Buffer.from(base64Match[1], 'base64').toString('utf-8');
          if (decoded.includes(".m3u8")) {
            console.log(`[Resolver] Voe base64 HLS resolved`);
            return decoded;
          }
        } catch {}
      }
      // Try direct match
      const direct = findM3u8InText(html) || findMp4InText(html);
      if (direct) return direct;
    }

    // --- Filemoon / Streamwish / Vidhide / Closeload (PACKER variants) ---
    if (/eval\(function\(p,a,c,k,e,d\)/.test(html)) {
      // Try multiple PACKED script matches
      const packedScripts = html.match(/eval\(function\(p,a,c,k,e,d\).*?split\('\|'\)\)\)/g) || [];
      for (const packed of packedScripts) {
        const unpacked = unpack(packed);
        if (unpacked !== packed) {
          const m3u8 = findM3u8InText(unpacked);
          if (m3u8) {
            console.log(`[Resolver] Found m3u8 in unpacked script`);
            return m3u8;
          }
          const mp4 = findMp4InText(unpacked);
          if (mp4) {
            console.log(`[Resolver] Found mp4 in unpacked script`);
            return mp4;
          }
        }
      }
    }

    // --- Master Embeds (Embed69, APiAlfa, SuperEmbed, etc.) ---
    if (/(?:embed69|apialfa|superembed|embed\.|moe\.|embeds\.)/.test(url)) {
      // Try bracket parser first (fast, O(n))
      const bracketData = extractDataLinkBrackets(html);
      if (bracketData) {
        const jwtLinks: string[] = [];
        for (const file of bracketData) {
          const embeds = file.sortedEmbeds || file.embeds || [];
          for (const embed of embeds) {
            const link = decodeJwtLink(embed.link || embed.url || "");
            if (link) jwtLinks.push(link);
          }
        }
        if (jwtLinks.length > 0) {
          console.log(`[Resolver] Extracted ${jwtLinks.length} JWT servers (bracket parser)`);
          return [...new Set(jwtLinks)];
        }
      }

      // JWT dataLink regex fallback
      const dataLinkMatch = /let\s+dataLink\s*=\s*(\[[\s\S]*?\]);/.exec(html)
        || /const\s+dataLink\s*=\s*(\[[\s\S]*?\]);/.exec(html)
        || /var\s+dataLink\s*=\s*(\[[\s\S]*?\]);/.exec(html);

      if (dataLinkMatch) {
        try {
          const dataLink = JSON.parse(dataLinkMatch[1]);
          const jwtLinks: string[] = [];
          for (const file of dataLink) {
            const embeds = file.sortedEmbeds || file.embeds || [];
            for (const embed of embeds) {
              const link = decodeJwtLink(embed.link || embed.url || "");
              if (link) jwtLinks.push(link);
            }
          }
          if (jwtLinks.length > 0) {
            console.log(`[Resolver] Extracted ${jwtLinks.length} JWT servers (regex)`);
            return [...new Set(jwtLinks)];
          }
        } catch (e) {
          console.warn("[Resolver] dataLink parse failed", (e as Error).message);
        }
      }

      // Any link/url/server patterns
      const allUrls = new Set<string>();
      const linkPatterns = [
        /["'](?:link|url|remote|src|embed)["']\s*:\s*["'](https?:\/\/[^"']+)["']/g,
        /data-link=["'](https?:\/\/[^"']+)["']/g,
        /data-url=["'](https?:\/\/[^"']+)["']/g,
        /data-src=["'](https?:\/\/[^"']+)["']/g,
      ];
      for (const pattern of linkPatterns) {
        for (const m of html.matchAll(pattern)) {
          const found = m[1];
          if (!found.includes('cloudflare') && !found.includes('google')) {
            allUrls.add(found);
          }
        }
      }
      if (allUrls.size > 0) {
        console.log(`[Resolver] Extracted ${allUrls.size} server URLs`);
        return [...allUrls];
      }
    }

    // ───────────────────────────────────────────
    // 2. Try base64-encoded URLs in scripts
    // ───────────────────────────────────────────
    const decodedUrl = tryDecodeBase64Urls(html);
    if (decodedUrl) {
      console.log(`[Resolver] Found base64-encoded stream`);
      return decodedUrl;
    }

    // ───────────────────────────────────────────
    // 3. Aggressive m3u8/mp4 scan
    // ───────────────────────────────────────────
    const m3u8 = findM3u8InText(html);
    if (m3u8) {
      console.log(`[Resolver] Found m3u8`);
      return m3u8;
    }

    const mp4 = findMp4InText(html);
    if (mp4) {
      console.log(`[Resolver] Found mp4`);
      return mp4;
    }

    // Ultra-aggressive: any m3u8 anywhere
    const allM3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi);
    if (allM3u8) {
      const filtered = allM3u8.filter(link =>
        !link.includes('google') &&
        !link.includes('cloudflare') &&
        !link.includes('youtube')
      );
      if (filtered.length > 0) {
        console.log(`[Resolver] Ultra-aggressive found ${filtered.length} m3u8`);
        return filtered[0];
      }
    }

    // ───────────────────────────────────────────
    // 4. Generic fallback: known video hosts
    // ───────────────────────────────────────────
    const genericUrls = [...html.matchAll(videoHostRegex())].map(m => m[0]);
    const uniqueGeneric = [...new Set(genericUrls)];
    if (uniqueGeneric.length > 0) {
      // Try to resolve each of these deeper
      console.log(`[Resolver] Found ${uniqueGeneric.length} secondary embed URLs to try`);
      // Return them - resolveToPlayableUrls will try each one
      return uniqueGeneric;
    }

    // ───────────────────────────────────────────
    // 5. Last resort: extract iframe src
    // ───────────────────────────────────────────
    const iframeMatch = /<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/i.exec(html);
    if (iframeMatch) {
      const iframeUrl = iframeMatch[1];
      if (!iframeUrl.includes('youtube.com') && !iframeUrl.includes('google.com')) {
        console.log(`[Resolver] Extracted iframe src`);
        return iframeUrl;
      }
    }

  } catch (e) {
    console.error(`[Resolver] Error for ${url}:`, (e as Error).message);
  }

  console.warn(`[Resolver] Could not resolve: ${url}`);
  return url;
}
