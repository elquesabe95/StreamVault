import { spawn } from "child_process";
import https from "https";
import http from "http";

function buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
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

function tryNative(url: string, headers: Record<string, string>, timeout: number): Promise<string> {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === "https:" ? https : http;
      const opts = {
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: "GET",
        headers: { ...headers, Host: u.hostname },
        timeout,
        rejectUnauthorized: false,
      };
      const req = mod.request(opts, (res) => {
        let data = "";
        res.on("data", (chunk: string) => data += chunk);
        res.on("end", () => {
          if (data.length > 500 && res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
            resolve(data);
          } else {
            resolve("");
          }
        });
      });
      req.on("error", () => resolve(""));
      req.on("timeout", () => { req.destroy(); resolve(""); });
      req.end();
    } catch {
      resolve("");
    }
  });
}

function tryCurl(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve) => {
    // spawn, not spawnSync: this process also serves every other request, and a
    // synchronous child blocks the event loop (and every pending timer) with it.
    const args = [
      "-s", "-L", "--max-time", "4",
      "--tlsv1.2",
      "--http2",
      "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "-H", "Accept-Language: es-ES,es;q=0.9",
      "-H", "Connection: keep-alive",
      "-H", "Upgrade-Insecure-Requests: 1",
      "-H", "Sec-Fetch-Dest: document",
      "-H", "Sec-Fetch-Mode: navigate",
      "-H", "Sec-Fetch-Site: none",
      "-H", "Sec-Fetch-User: ?1",
    ];
    Object.entries(headers).forEach(([k, v]) => args.push("-H", `${k}: ${v}`));
    args.push(url);

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("curl", args, { windowsHide: true });
    } catch {
      resolve("");
      return;
    }

    let out = "";
    let done = false;
    let killer: ReturnType<typeof setTimeout>;
    const finish = (value: string) => {
      if (done) return;
      done = true;
      clearTimeout(killer);
      resolve(value);
    };
    killer = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} finish(""); }, 6000);

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (out.length < 5 * 1024 * 1024) out += chunk;
    });
    child.on("error", () => finish(""));   // curl not installed on this image
    child.on("close", () => finish(out.length > 300 ? out : ""));
  });
}

function isCloudflareChallenge(html: string): boolean {
  return html.includes("cf-browser-verify") ||
    html.includes("_cf_chl_opt") ||
    html.includes("challenge-platform") ||
    (html.includes("Checking your browser") && html.length < 2000) ||
    (html.includes("Just a moment") && html.length < 2000);
}

function getProxies(): string[] {
  // Only the Cloudflare Worker still answers. codetabs (HTTP 522), corsproxy.io
  // (403) and allorigins (522) were all dead, and each one burned up to
  // PROXY_TIMEOUT_MS of the request budget before failing — on Render that was
  // most of the time available to scrape. Add replacements via PROXY_EXTRA_URLS
  // (comma-separated); an entry ending in "=" or "?" gets the encoded target
  // appended as-is, anything else gets "?url=".
  const extra = (process.env.PROXY_EXTRA_URLS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  return [
    process.env.PROXY_WORKER_URL || "https://streamvault-proxy.elquesabe95.workers.dev",
    ...extra,
  ];
}

const PROXY_TIMEOUT = Number(process.env.PROXY_TIMEOUT_MS) || 10000;
const DIRECT_TIMEOUT = Number(process.env.DIRECT_TIMEOUT_MS) || 6000;

export async function readPage(url: string, customHeaders?: Record<string, string>, useProxy: boolean = false): Promise<string> {
  const headers = buildHeaders(customHeaders);

  // Append cache-busting to avoid stale proxy responses
  const cacheBust = `_cb=${Date.now()}`;
  const freshUrl = url.includes("?") ? `${url}&${cacheBust}` : `${url}?${cacheBust}`;

  const runProxyChain = async (): Promise<string> => {
    for (const proxy of getProxies()) {
      const isCFWorker = proxy.includes("workers.dev");

      // An entry that already ends in its query parameter takes the target
      // appended directly; everything else gets "?url=".
      let proxyUrl = proxy.endsWith("=") || proxy.endsWith("?")
        ? `${proxy}${encodeURIComponent(freshUrl)}`
        : `${proxy}?url=${encodeURIComponent(freshUrl)}`;

      if (isCFWorker) {
        if (headers["Referer"]) proxyUrl += `&ref=${encodeURIComponent(headers["Referer"])}`;
        if (headers["Origin"]) proxyUrl += `&origin=${encodeURIComponent(headers["Origin"])}`;
      }

      const html = await tryFetch(proxyUrl, headers, PROXY_TIMEOUT);
      if (html && !isCloudflareChallenge(html) && html.length > 500) {
        console.log(`[readPage] Proxy OK: ${proxy.substring(0, 30)} (${html.length}b)`);
        return html;
      }
    }
    return "";
  };

  if (useProxy) {
    // Where the host's outbound IPs aren't blocked by the target site, a direct
    // hit costs ~1s against ~3-8s through the proxy. Opt in with
    // SCRAPER_DIRECT_FIRST=1 (measure first: /api/v1/debug?action=net).
    if (process.env.SCRAPER_DIRECT_FIRST === "1") {
      const direct = await tryFetch(freshUrl, headers, DIRECT_TIMEOUT);
      if (direct && !isCloudflareChallenge(direct)) {
        console.log(`[readPage] Direct-first (${direct.length}b): ${url.substring(0, 60)}`);
        return direct;
      }
    }
    const html = await runProxyChain();
    if (html) return html;
    console.warn(`[readPage] Proxy failed for: ${url.substring(0, 80)}`);
    return "";
  }

  // No proxy requested — try direct then curl then native
  let html = await tryFetch(freshUrl, headers, DIRECT_TIMEOUT);
  if (html && !isCloudflareChallenge(html)) {
    console.log(`[readPage] Direct (${html.length}b): ${url.substring(0, 60)}`);
    return html;
  }
  if (html) console.warn(`[readPage] Cloudflare detected on direct`);

  html = await tryCurl(freshUrl, headers);
  if (html && !isCloudflareChallenge(html)) {
    console.log(`[readPage] curl (${html.length}b)`);
    return html;
  }

  html = await tryNative(freshUrl, headers, DIRECT_TIMEOUT);
  if (html && !isCloudflareChallenge(html)) {
    console.log(`[readPage] Native (${html.length}b): ${url.substring(0, 60)}`);
    return html;
  }

  // Fallback to proxy if direct/curl/native failed
  console.warn(`[readPage] Direct/Curl/Native failed for: ${url.substring(0, 60)}. Trying proxy fallback...`);
  html = await runProxyChain();
  if (html) return html;

  console.warn(`[readPage] FAILED after all attempts (including proxy fallback): ${url.substring(0, 80)}`);
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
