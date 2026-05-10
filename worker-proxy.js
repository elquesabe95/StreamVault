// Cloudflare Worker Proxy for StreamVault
// Usage: https://your-worker.workers.dev/?url=https://embed69.org/f/tt0372784/

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response("Missing ?url= parameter", { status: 400 });
    }

    try { new URL(target); } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      "Referer": "https://pelispedia.mov/",
      "Origin": "https://pelispedia.mov",
    };

    try {
      const res = await fetch(target, { headers, redirect: "follow" });
      const body = await res.text();

      return new Response(body, {
        status: res.status,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300",
        },
      });
    } catch (e) {
      return new Response("Proxy error: " + e.message, { status: 502 });
    }
  },
};
