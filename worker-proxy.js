// Cloudflare Worker Proxy for StreamVault
// Usage: https://your-worker.workers.dev/?url=https://target.com/&ref=https://referer.com/

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    const customReferer = url.searchParams.get("ref") || url.searchParams.get("referer");
    const customOrigin = url.searchParams.get("origin");

    if (!target) {
      return new Response("Missing ?url= parameter", { 
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    try { new URL(target); } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    const targetUrl = new URL(target);
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      "Referer": customReferer || `https://${targetUrl.hostname}/`,
      "Origin": customOrigin || `https://${targetUrl.hostname}`,
    };

    try {
      const res = await fetch(target, { 
        headers, 
        redirect: "follow"
      });
      
      const body = await res.text();

      return new Response(body, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("Content-Type") || "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (e) {
      return new Response("Proxy error: " + e.message, { 
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
  },
};

