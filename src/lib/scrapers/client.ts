import { spawnSync } from "child_process";

function buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
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
  const worker = process.env.PROXY_WORKER_URL || "https://streamvault-proxy.elquesabe95.workers.dev";
  return [worker];
}

export async function readPage(url: string, customHeaders?: Record<string, string>, useProxy: boolean = false): Promise<string> {
  const headers = buildHeaders(customHeaders);
  const userAgent = headers["User-Agent"];

  // 1. Direct fetch — fastest
  let html = await tryFetch(url, headers, 8000);
  if (html && !isCloudflareChallenge(html)) {
    console.log(`[readPage] Direct (${html.length}b): ${url.substring(0, 60)}`);
    return html;
  }
  if (html) console.warn(`[readPage] Cloudflare detected on direct`);

  // 2. Direct curl — bypasses some JS challenges
  html = tryCurl(url, headers);
  if (html && !isCloudflareChallenge(html)) {
    console.log(`[readPage] curl (${html.length}b)`);
    return html;
  }

  // 3. Proxy fallback — try multiple proxies
  if (useProxy) {
    for (const proxy of getProxies()) {
      // Support both ?url= format (Cloudflare Worker) and direct append
      const sep = proxy.includes("workers.dev") ? "?url=" : "";
      const proxyUrl = proxy + sep + encodeURIComponent(url);
      html = await tryFetch(proxyUrl, headers, 10000);
      if (html && !isCloudflareChallenge(html) && html.length > 500) {
        console.log(`[readPage] Proxy OK: ${proxy.substring(0, 30)} (${html.length}b)`);
        return html;
      }
    }
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
