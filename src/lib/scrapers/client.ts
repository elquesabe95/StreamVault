import { spawnSync } from "child_process";

function buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    ...customHeaders
  };
}

async function tryFetch(url: string, headers: Record<string, string>, timeout: number): Promise<string> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeout), redirect: "follow" });
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 500) return text;
    }
  } catch {}
  return "";
}

function tryCurl(url: string, headers: Record<string, string>): string {
  try {
    const args = ["-s", "-L", "--max-time", "8"];
    Object.entries(headers).forEach(([k, v]) => {
      args.push("-H", `${k}: ${v}`);
    });
    args.push(url);
    const result = spawnSync("curl", args, { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
    if (result.stdout?.length > 300) return result.stdout;
  } catch {}
  return "";
}

function isCloudflareChallenge(html: string): boolean {
  return html.includes("cf-browser-verify") ||
    html.includes("_cf_chl_opt") ||
    html.includes("challenge-platform") ||
    (html.includes("Checking your browser") && html.length < 2000) ||
    (html.includes("Just a moment") && html.length < 2000);
}

function getProxies(): string[] {
  return [
    process.env.PROXY_WORKER_URL || "https://streamvault-proxy.elquesabe95.workers.dev",
    "https://corsproxy.io/?",
    "https://api.allorigins.win/raw?url=",
  ];
}

export async function readPage(url: string, customHeaders?: Record<string, string>, useProxy: boolean = false): Promise<string> {
  const headers = buildHeaders(customHeaders);

  // Append cache-busting to avoid stale proxy responses
  const cacheBust = `_cb=${Date.now()}`;
  const freshUrl = url.includes("?") ? `${url}&${cacheBust}` : `${url}?${cacheBust}`;

  // When proxy is requested, go straight to it (skip direct/curl which are blocked on Render)
  if (useProxy) {
    for (const proxy of getProxies()) {
      const isCFWorker = proxy.includes("workers.dev");
      const isCorsProxy = proxy.includes("corsproxy.io");
      const isAllOrigins = proxy.includes("allorigins.win");

      let proxyUrl: string;
      if (isCorsProxy || isAllOrigins) {
        proxyUrl = `${proxy}${encodeURIComponent(freshUrl)}`;
      } else {
        proxyUrl = `${proxy}?url=${encodeURIComponent(freshUrl)}`;
      }

      if (isCFWorker) {
        if (headers["Referer"]) proxyUrl += `&ref=${encodeURIComponent(headers["Referer"])}`;
        if (headers["Origin"]) proxyUrl += `&origin=${encodeURIComponent(headers["Origin"])}`;
      }

      const html = await tryFetch(proxyUrl, headers, 10000);
      if (html && !isCloudflareChallenge(html) && html.length > 500) {
        console.log(`[readPage] Proxy OK: ${proxy.substring(0, 30)} (${html.length}b)`);
        return html;
      }
    }
    console.warn(`[readPage] Proxy failed for: ${url.substring(0, 80)}`);
    return "";
  }

  // No proxy requested — try direct then curl
  let html = await tryFetch(freshUrl, headers, 6000);
  if (html && !isCloudflareChallenge(html)) {
    console.log(`[readPage] Direct (${html.length}b): ${url.substring(0, 60)}`);
    return html;
  }
  if (html) console.warn(`[readPage] Cloudflare detected on direct`);

  html = tryCurl(freshUrl, headers);
  if (html && !isCloudflareChallenge(html)) {
    console.log(`[readPage] curl (${html.length}b)`);
    return html;
  }

  console.warn(`[readPage] FAILED after all attempts: ${url.substring(0, 80)}`);
  return "";
}

export async function readJson<T = any>(url: string): Promise<T | null> {
  try {
    const isAnimux = url.includes("animux.site");
    const headers: Record<string, string> = {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
    };

    if (isAnimux) {
      headers["Referer"] = "https://animux.site/canales";
      headers["Origin"] = "https://animux.site";
    }

    const text = await readPage(url, headers, true);
    if (!text) return null;

    const isHtml = text.trim().toLowerCase().startsWith("<!doctype") || text.trim().toLowerCase().startsWith("<html");
    if (isHtml) {
      console.warn(`[readJson] Received HTML from ${url}. Attempting regex extraction...`);
    }

    try {
      if (!isHtml) return JSON.parse(text.trim()) as T;
    } catch {}

    const jsonMatch = text.match(/(\[\s*\{[\s\S]*\}\s*\]|\{\s*"channels"[\s\S]*\})/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]) as T; } catch {}
    }

    const allMatches = text.match(/\[[\s\S]*?\]|\{[\s\S]*?\}/g);
    if (allMatches) {
      for (const match of allMatches.sort((a, b) => b.length - a.length)) {
        if (match.length < 50) continue;
        try {
          const parsed = JSON.parse(match);
          if (Array.isArray(parsed) || parsed.channels || parsed.streams) return parsed as T;
        } catch {}
      }
    }

    if (isHtml) return null;
    throw new Error("Could not parse JSON");
  } catch (e) {
    console.error(`[readJson] Error:`, (e as Error).message);
    return null;
  }
}
