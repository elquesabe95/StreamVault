import { readPage } from "./client";

function videoHostRegex() {
  return /https?:\/\/(?:streamwish|filemoon|vidhide|streamtape|dood(?:stream)?|voe|waaw|upstream|wishembed|awish|embedrise|mixdrop|mp4upload|closeload|embedsito|uqload|wolfstream|minochinos|hglink|bysedikamoum)\.[a-z]+\/[^\s"'<>]+/g;
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
  const match = /eval\(function\(p,a,c,k,e,d\).*?return p}\('(.*?)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/.exec(code);
  if (!match) return code;
  let p = match[1];
  const a = parseInt(match[2]);
  let c = parseInt(match[3]);
  const k = match[4].split('|');

  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + c.toString(a > 36 ? 36 : a) + '\\b', 'g'), k[c]);
    }
  }

  if (/eval\(function\(p,a,c,k,e,d\)/.test(p)) {
    try { return unpack(p); } catch {}
  }
  return p;
}

function findM3u8InText(text: string): string | null {
  const patterns = [
    /["'](https?:\/\/[^"'\s<>]+?\.m3u8[^"'\s<>]*)["']/,
    /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/,
    /source\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/,
    /src\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/,
    /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/,
  ];
  for (const p of patterns) { const m = p.exec(text); if (m) return m[1]; }
  return null;
}

function findMp4InText(text: string): string | null {
  const patterns = [
    /["'](https?:\/\/[^"'\s<>]+?\.mp4[^"'\s<>]*)["']/,
    /file\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/,
    /src\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/,
    /(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/,
  ];
  for (const p of patterns) { const m = p.exec(text); if (m) return m[1]; }
  return null;
}

/**
 * Extract dataLink array from Master Embed pages
 */
function extractDataLink(html: string): any[] | null {
  // Match: let/var/const dataLink = [{...}];
  const patterns = [
    /(?:let|var|const)\s+dataLink\s*=\s*(\[[\s\S]*?\]);/,
    /window\.dataLink\s*=\s*(\[[\s\S]*?\]);/,
    /dataLink\s*=\s*(\[[\s\S]*?\]);/,
  ];
  for (const pattern of patterns) {
    const m = pattern.exec(html);
    if (m) {
      try {
        const parsed = JSON.parse(m[1]);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn(`[Resolver] dataLink JSON parse failed: ${(e as Error).message}`);
      }
    }
  }
  return null;
}

export async function resolveStream(url: string): Promise<string | string[]> {
  if (url.includes(".m3u8") || url.includes(".mp4")) return url;

  console.log(`[Resolver] ${url.substring(0, 80)}`);

  try {
    const html = await readPage(url, {}, false);
    if (!html || html.length < 200) {
      console.warn(`[Resolver] Empty/short response`);
      return url;
    }

    // ═══════════════════════════════════════════
    // STEP 1: URL-SPECIFIC handlers (most reliable)
    // ═══════════════════════════════════════════

    // --- Master Embeds (embed69, apialfa, superembed, etc.) ---
    if (/(?:embed69|apialfa|superembed|embed\.su|moe\.|embeds\.)/.test(url)) {
      const dataLink = extractDataLink(html);
      if (dataLink) {
        const jwtLinks: string[] = [];
        for (const file of dataLink) {
          const embeds = file.sortedEmbeds || file.embeds || [];
          for (const embed of embeds) {
            const link = decodeJwtLink(embed.link || embed.url || "");
            if (link) jwtLinks.push(link);
          }
        }
        if (jwtLinks.length > 0) {
          console.log(`[Resolver] embed69: ${jwtLinks.length} servers extracted`);
          // Return video host URLs - they'll be resolved in the second pass
          return [...new Set(jwtLinks)];
        }
      }

      // Fallback: look for any data-link attributes
      const allUrls = new Set<string>();
      for (const pattern of [
        /["'](?:link|url|remote|embed)["']\s*:\s*["'](https?:\/\/[^"']+)["']/g,
        /data-link=["'](https?:\/\/[^"']+)["']/g,
        /data-url=["'](https?:\/\/[^"']+)["']/g,
        /data-src=["'](https?:\/\/[^"']+)["']/g,
      ]) {
        for (const m of html.matchAll(pattern)) {
          if (!m[1].includes('cloudflare') && !m[1].includes('google')) {
            allUrls.add(m[1]);
          }
        }
      }
      if (allUrls.size > 0) {
        console.log(`[Resolver] embed69 fallback: ${allUrls.size} URLs`);
        return [...allUrls];
      }
    }

    // --- Streamtape ---
    if (url.includes("streamtape.com") || url.includes("stape") || url.includes("strcloud")) {
      const linkMatch = /id=["']robotlink["'][^>]*>([^<]+)/.exec(html)
        || /id=["']norobotlink["'][^>]*>([^<]+)/.exec(html);
      if (linkMatch) {
        let robotLink = linkMatch[1];
        const partMatch = /document\.getElementById\(['"]robotlink['"]\)\.innerHTML\s*\+=\s*['"]([^'"]+)['"]/.exec(html);
        if (partMatch) robotLink += partMatch[1];
        if (!robotLink.startsWith("http")) robotLink = "https:" + robotLink;
        console.log(`[Resolver] Streamtape OK`);
        return robotLink;
      }
    }

    // --- Doodstream ---
    if (url.includes("dood") || url.includes("ds2play")) {
      const passMatch = /\/pass_md5\/([^'"]+)/.exec(html);
      if (passMatch) {
        const tokenMatch = /[?&]token=([^&"'\s]+)/.exec(html);
        const passUrl = `https://dood.to/pass_md5/${passMatch[1]}`;
        if (tokenMatch) {
          console.log(`[Resolver] Doodstream OK`);
          return `${passUrl}?token=${tokenMatch[1]}`;
        }
      }
      const m3u8 = findM3u8InText(html);
      if (m3u8) return m3u8;
    }

    // --- Voe.sx ---
    if (url.includes("voe.sx") || url.includes("voe")) {
      const base64Match = /["']([a-zA-Z0-9+/=]{40,})["']/.exec(html);
      if (base64Match) {
        try {
          const decoded = Buffer.from(base64Match[1], 'base64').toString('utf-8');
          if (decoded.includes(".m3u8")) {
            console.log(`[Resolver] Voe base64 HLS OK`);
            return decoded;
          }
        } catch {}
      }
      const direct = findM3u8InText(html) || findMp4InText(html);
      if (direct) return direct;
    }

    // --- Vidhide / Minochinos ---
    if (url.includes("vidhide") || url.includes("minochinos")) {
      // Look for direct video URLs or PACKER
      const m3u8 = findM3u8InText(html);
      if (m3u8) return m3u8;
      const mp4 = findMp4InText(html);
      if (mp4) return mp4;
    }

    // ═══════════════════════════════════════════
    // STEP 2: PACKER detection (Filemoon, Streamwish, etc.)
    // ═══════════════════════════════════════════
    if (/eval\(function\(p,a,c,k,e,d\)/.test(html)) {
      const packedScripts = html.match(/eval\(function\(p,a,c,k,e,d\).*?split\('\|'\)\)\)/g) || [];
      for (const packed of packedScripts) {
        const unpacked = unpack(packed);
        if (unpacked !== packed) {
          const m3u8 = findM3u8InText(unpacked);
          if (m3u8) { console.log(`[Resolver] PACKER m3u8`); return m3u8; }
          const mp4 = findMp4InText(unpacked);
          if (mp4) { console.log(`[Resolver] PACKER mp4`); return mp4; }
        }
      }
    }

    // ═══════════════════════════════════════════
    // STEP 3: Aggressive m3u8/mp4 scan
    // ═══════════════════════════════════════════
    const m3u8 = findM3u8InText(html);
    if (m3u8) { console.log(`[Resolver] m3u8 found`); return m3u8; }

    const mp4 = findMp4InText(html);
    if (mp4) { console.log(`[Resolver] mp4 found`); return mp4; }

    // Ultra-aggressive: any m3u8 anywhere
    const allM3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi);
    if (allM3u8) {
      const filtered = allM3u8.filter(link =>
        !link.includes('google') && !link.includes('cloudflare') && !link.includes('youtube')
      );
      if (filtered.length > 0) { console.log(`[Resolver] ultra m3u8`); return filtered[0]; }
    }

    // ═══════════════════════════════════════════
    // STEP 4: Generic fallback — known video hosts
    // ═══════════════════════════════════════════
    const genericUrls = [...html.matchAll(videoHostRegex())].map(m => m[0]);
    const uniqueGeneric = [...new Set(genericUrls)];
    if (uniqueGeneric.length > 0) {
      console.log(`[Resolver] ${uniqueGeneric.length} secondary embeds`);
      return uniqueGeneric;
    }

    // Last resort: first iframe src
    const iframeMatch = /<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/i.exec(html);
    if (iframeMatch && !iframeMatch[1].includes('youtube.com')) {
      console.log(`[Resolver] iframe src`);
      return iframeMatch[1];
    }

  } catch (e) {
    console.error(`[Resolver] Error:`, (e as Error).message);
  }

  console.warn(`[Resolver] Failed: ${url.substring(0, 60)}`);
  return url;
}
