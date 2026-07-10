import { NextRequest, NextResponse } from "next/server";

// Known Referer mappings for CDN domains
const CDN_REFERERS: Record<string, string> = {
  "acek-cdn.com": "https://awish.pro/",
  "dramiyos-cdn.com": "https://awish.pro/",
  "streamwish.com": "https://awish.pro/",
  "filemoon.sx": "https://filemoon.sx/",
  "vidhide.com": "https://vidhide.com/",
  "streamtape.com": "https://streamtape.com/",
  "dood.to": "https://dood.to/",
};

function getRefererForUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    for (const [domain, referer] of Object.entries(CDN_REFERERS)) {
      if (hostname.includes(domain)) return referer;
    }
  } catch {}
  return "";
}

function rewriteM3u8(content: string, baseUrl: string, proxyBase: string, referer: string): string {
  const base = new URL(baseUrl);
  const lines = content.split("\n");

  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;

    // Resolve relative URLs to absolute
    let absolute: string;
    try {
      absolute = new URL(trimmed, base).toString();
    } catch {
      return line;
    }

    // Wrap through our proxy
    const params = new URLSearchParams({ url: absolute });
    if (referer) params.set("referer", referer);
    return `${proxyBase}?${params.toString()}`;
  }).join("\n");
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const customReferer = req.nextUrl.searchParams.get("referer");

  if (!url) return new NextResponse("No URL provided", { status: 400 });

  // Security: only proxy http/https URLs
  if (!/^https?:\/\//i.test(url)) {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  const referer = customReferer || getRefererForUrl(url);

  try {
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Origin": referer ? new URL(referer).origin : "",
    };
    if (referer) fetchHeaders["Referer"] = referer;

    const response = await fetch(url, { headers: fetchHeaders });

    if (!response.ok) {
      return new NextResponse(`Upstream error: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "";
    const isM3u8 = contentType.includes("mpegurl") || url.includes(".m3u8");

    if (isM3u8) {
      const text = await response.text();
      // Build proxy base URL from the request
      const reqUrl = new URL(req.url);
      const proxyBase = `${reqUrl.origin}/api/v1/proxy`;
      const rewritten = rewriteM3u8(text, url, proxyBase, referer);

      return new NextResponse(rewritten, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Binary passthrough for .ts segments, keys, etc.
    const data = await response.arrayBuffer();
    const headers: Record<string, string> = {
      "Content-Type": contentType || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
    };

    const contentLength = response.headers.get("content-length");
    if (contentLength) headers["Content-Length"] = contentLength;

    return new NextResponse(data, { headers });
  } catch (error) {
    console.error("[Proxy] Error fetching", url, error);
    return new NextResponse("Proxy Error", { status: 500 });
  }
}
