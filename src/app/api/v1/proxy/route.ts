export const runtime = "edge";

const CDN_REFERERS: Record<string, string> = {
  "acek-cdn.com": "https://awish.pro/",
  "dramiyos-cdn.com": "https://awish.pro/",
  "filemoon.sx": "https://filemoon.sx/",
  "vidhide.com": "https://vidhide.com/",
  "streamtape.com": "https://streamtape.com/",
  "dood.to": "https://dood.to/",
};

function getReferer(url: string, custom?: string | null): string {
  if (custom) return custom;
  try {
    const host = new URL(url).hostname;
    for (const [domain, ref] of Object.entries(CDN_REFERERS)) {
      if (host.includes(domain)) return ref;
    }
  } catch {}
  return "";
}

/**
 * Rewrites an m3u8 playlist so every URL (segments, variant playlists,
 * AES-128 keys, EXT-X-MAP init segments) goes through our proxy.
 * Without this, IP-locked CDN tokens fail on the user's browser.
 */
function rewriteM3u8(text: string, baseUrl: string, proxyOrigin: string, referer: string): string {
  const base = new URL(baseUrl);

  const proxyUrl = (rawUrl: string): string => {
    let abs: string;
    try { abs = new URL(rawUrl, base).toString(); } catch { return rawUrl; }
    const p = new URLSearchParams({ url: abs });
    if (referer) p.set("referer", referer);
    return `${proxyOrigin}/api/v1/proxy?${p}`;
  };

  return text.split("\n").map(line => {
    const trimmed = line.trim();

    if (!trimmed) return line;

    // ── Non-comment lines → segment / variant playlist URLs ─────────────────
    if (!trimmed.startsWith("#")) {
      return proxyUrl(trimmed);
    }

    // ── #EXT-X-KEY:METHOD=AES-128,URI="...",IV=... ──────────────────────────
    if (trimmed.startsWith("#EXT-X-KEY")) {
      return trimmed.replace(/URI="([^"]+)"/, (_: string, uri: string) => `URI="${proxyUrl(uri)}"`);
    }

    // ── #EXT-X-MAP:URI="..." ─────────────────────────────────────────────────
    if (trimmed.startsWith("#EXT-X-MAP")) {
      return trimmed.replace(/URI="([^"]+)"/, (_: string, uri: string) => `URI="${proxyUrl(uri)}"`);
    }

    // ── #EXT-X-MEDIA:URI="..." (audio/subtitle tracks) ───────────────────────
    if (trimmed.startsWith("#EXT-X-MEDIA") && trimmed.includes('URI="')) {
      return trimmed.replace(/URI="([^"]+)"/, (_: string, uri: string) => `URI="${proxyUrl(uri)}"`);
    }

    return line;
  }).join("\n");
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const url = searchParams.get("url");
  const customReferer = searchParams.get("referer");

  if (!url || !/^https?:\/\//i.test(url)) {
    return new Response("Invalid URL", { status: 400 });
  }

  const referer = getReferer(url, customReferer);
  const fetchHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
  };
  if (referer) {
    fetchHeaders["Referer"] = referer;
    try { fetchHeaders["Origin"] = new URL(referer).origin; } catch {}
  }

  const upstream = await fetch(url, { headers: fetchHeaders });

  if (!upstream.ok) {
    return new Response(`Upstream ${upstream.status}`, { status: upstream.status });
  }

  const ct = upstream.headers.get("content-type") || "";
  const isM3u8 = ct.includes("mpegurl") || /\.m3u8(?:[?#]|$)/i.test(url);

  if (isM3u8) {
    const text = await upstream.text();
    const rewritten = rewriteM3u8(text, url, origin, referer);
    return new Response(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Stream segments / keys directly — no buffering
  return new Response(upstream.body, {
    headers: {
      "Content-Type": ct || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
