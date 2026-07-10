import { readPage } from "./client";
import crypto from "crypto";

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

function sha256(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function sha256Bytes(str: string): Buffer {
  return crypto.createHash("sha256").update(str).digest();
}

function decryptAES(encryptedBase64: string, aesKeyBytes: Buffer): string | null {
  try {
    const raw = Buffer.from(encryptedBase64, "base64");
    const iv = raw.subarray(0, 16);
    const ciphertext = raw.subarray(16);
    const key = aesKeyBytes.subarray(0, 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(ciphertext, undefined, "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    return null;
  }
}

async function solvePoW(challenge: string, difficulty: number, salt: string): Promise<Buffer> {
  const prefix = "0".repeat(difficulty);
  let nonce = 0;
  while (true) {
    const hash = sha256(challenge + nonce);
    if (hash.startsWith(prefix)) {
      return sha256Bytes(challenge + nonce + salt);
    }
    nonce++;
  }
}

async function resolveMasterEmbed(html: string): Promise<string[]> {
  const jwtLinks: string[] = [];
  
  // Try bracket parser first (fast, O(n))
  const bracketData = extractDataLinkBrackets(html);
  
  // Try to solve PoW if parameters are present
  const challengeMatch = /const\s+POW_CHALLENGE\s*=\s*['"]([^'"]+)['"]/.exec(html);
  const diffMatch = /const\s+POW_DIFFICULTY\s*=\s*(\d+)/.exec(html);
  const saltMatch = /const\s+POW_SALT\s*=\s*['"]([^'"]+)['"]/.exec(html);
  
  let aesKeyBytes: Buffer | null = null;
  if (challengeMatch && diffMatch && saltMatch) {
    const challenge = challengeMatch[1];
    const difficulty = parseInt(diffMatch[1]);
    const salt = saltMatch[1];
    console.log(`[Resolver] Solving PoW: challenge=${challenge}, difficulty=${difficulty}, salt=${salt}`);
    const start = Date.now();
    try {
      aesKeyBytes = await solvePoW(challenge, difficulty, salt);
      console.log(`[Resolver] PoW solved in ${Date.now() - start}ms`);
    } catch (e) {
      console.error("[Resolver] PoW solver failed", e);
    }
  }

  if (bracketData) {
    for (const file of bracketData) {
      const embeds = file.sortedEmbeds || file.embeds || [];
      for (const embed of embeds) {
        const rawLink = embed.link || embed.url || "";
        if (rawLink) {
          let link: string | null = null;
          if (rawLink.includes(".")) {
            link = decodeJwtLink(rawLink);
          } else if (aesKeyBytes) {
            link = decryptAES(rawLink, aesKeyBytes);
          }
          if (link) jwtLinks.push(link);
        }
      }
    }
  }

  // Fallback: JWT dataLink regex — handles both array and nested object formats
  const dlRegex = /(?:let|const|var)\s+dataLink\s*=\s*(\[[\s\S]*?\]|\{[\s\S]*\});/;
  const dataLinkMatch = dlRegex.exec(html);

  if (dataLinkMatch && jwtLinks.length === 0) {
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
        const rawLink = embed.link || embed.url || "";
        if (rawLink) {
          let link: string | null = null;
          if (rawLink.includes(".")) {
            link = decodeJwtLink(rawLink);
          } else if (aesKeyBytes) {
            link = decryptAES(rawLink, aesKeyBytes);
          }
          if (link) jwtLinks.push(link);
        }
      }
    } catch (e) {
      console.warn("[Resolver] dataLink parse failed", (e as Error).message);
    }
  }

  // Fallback to generic URL patterns if no JWT/AES links resolved
  if (jwtLinks.length === 0) {
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
    return [...allUrls];
  }

  return [...new Set(jwtLinks)];
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
    const needsProxy = false;
    const extraHeaders: Record<string, string> = {};

    // PelisPedia uses /vidurl/ internal player — follow it
    if (url.includes("pelispedia.mov/vidurl/")) {
      extraHeaders["Referer"] = "https://pelispedia.mov/";
      let vidHtml = await readPage(url, extraHeaders, false);
      if (!vidHtml || vidHtml.length < 500) {
        console.log(`[Resolver] Direct failed for pelispedia vidurl, retrying via proxy...`);
        vidHtml = await readPage(url, extraHeaders, true);
      }
      if (vidHtml && vidHtml.length > 500) {
        console.log(`[Resolver] Following PelisPedia vidurl (${vidHtml.length}b)`);
        // Check for dataLink first (new AES/JWT schema)
        if (vidHtml.includes("dataLink")) {
          const decryptedLinks = await resolveMasterEmbed(vidHtml);
          if (decryptedLinks.length > 0) {
            console.log(`[Resolver] Decrypted ${decryptedLinks.length} servers in vidurl page`);
            const resolved = await Promise.all(decryptedLinks.map(u => resolveStream(u).catch(() => u)));
            const all: string[] = [];
            for (const r of resolved) {
              if (Array.isArray(r)) all.push(...r);
              else all.push(r);
            }
            return [...new Set(all)];
          }
        }

        // Otherwise extract iframe sources (old fallback)
        const foundUrls: string[] = [];
        const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
        let m;
        while ((m = iframeRegex.exec(vidHtml)) !== null) {
          let u = m[1];
          if (u.startsWith("//")) u = "https:" + u;
          else if (u.startsWith("/")) u = "https://pelispedia.mov" + u;
          if (!u.includes('youtube') && !u.includes('google') && !u.includes('cloudflare')) {
            foundUrls.push(u);
          }
        }
        if (foundUrls.length > 0) {
          console.log(`[Resolver] Found ${foundUrls.length} embeds in vidurl page`);
          const resolved = await Promise.all(foundUrls.map(u => resolveStream(u).catch(() => u as string)));
          const all: string[] = [];
          for (const r of resolved) {
            if (Array.isArray(r)) all.push(...r);
            else all.push(r);
          }
          return [...new Set(all)];
        }
      }
    }

    if (url.includes("embed69.org")) {
      extraHeaders["Referer"] = "https://pelispedia.mov/";
    }
    if (url.includes("tveo.site")) {
      extraHeaders["Referer"] = "https://tveo.site/";
      extraHeaders["Origin"] = "https://tveo.site";
    }
    let html = await readPage(url, extraHeaders, needsProxy);

    // If direct failed or was blocked (too short), retry with proxy for any URL to maximize direct stream extraction
    if (!html || html.length < 1000) {
      console.log(`[Resolver] Direct failed or returned short response (${html?.length || 0}b), retrying via proxy for: ${url}`);
      html = await readPage(url, extraHeaders, true);
    }

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

    // --- tveo.site (JW Player) ---
    if (url.includes("tveo.site")) {
      // JW Player sources: [{file: "url"}]
      const jwMatch = /sources\s*:\s*\[[\s\S]{0,300}?file\s*:\s*["'](https?:\/\/[^"']+)["']/i.exec(html);
      if (jwMatch) { console.log(`[Resolver] tveo.site JW Player resolved`); return jwMatch[1]; }
      const m3u8 = findM3u8InText(html);
      if (m3u8) { console.log(`[Resolver] tveo.site m3u8 found`); return m3u8; }
      const mp4 = findMp4InText(html);
      if (mp4) { console.log(`[Resolver] tveo.site mp4 found`); return mp4; }
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

    // --- Master Embeds (Embed69, APiAlfa, SuperEmbed, PelisPedia vidurl, etc.) ---
    if (/(?:embed69|apialfa|superembed|embed\.|moe\.|embeds\.|pelispedia\.mov\/vidurl\/)/.test(url)) {
      const decryptedLinks = await resolveMasterEmbed(html);
      if (decryptedLinks.length > 0) {
        console.log(`[Resolver] Extracted ${decryptedLinks.length} servers from Master Embed`);
        return decryptedLinks;
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
