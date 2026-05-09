import { spawnSync } from "child_process";

/**
 * ULTRA-ROBUST page reader.
 * Uses native fetch first, falls back to SILENT CURL.EXE.
 */
export async function readPage(url: string, customHeaders?: Record<string, string>): Promise<string> {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Apple) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
  ];
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  
  console.log(`[readPage] Attempting: ${url}`);
 
  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": "https://www.google.com/",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    ...customHeaders
  };

  // Try Native Fetch
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const text = await response.text();
      if (text && text.length > 300) {
        // console.log(`[readPage] Fetch Success: ${url} (${text.length} bytes)`);
        return text;
      }
    }
    console.warn(`[readPage] Fetch weak response (status: ${response.status})`);
  } catch (e: any) {
    console.warn(`[readPage] Fetch Error: ${e.message}`);
  }

  // FALLBACK TO CURL.EXE (using spawnSync to handle headers safely)
  try {
    console.log(`[readPage] Launching CURL fallback for: ${url}`);
    const curlArgs = ["-s", "-L", "--connect-timeout", "4", "--max-time", "6"];
    
    Object.entries(headers).forEach(([k, v]) => {
      curlArgs.push("-H", `${k}: ${v}`);
    });
    
    curlArgs.push(url);
    
    const curlExecutable = process.platform === "win32" ? "curl.exe" : "curl";
    const result = spawnSync(curlExecutable, curlArgs, { 
      encoding: "utf8", 
      maxBuffer: 1024 * 1024 * 10,
      windowsHide: true
    });
    
    const output = result.stdout;
    
    if (output && output.length > 200) {
      console.log(`[readPage] CURL Success: ${url} (${output.length} bytes)`);
      return output;
    }
    if (result.error) {
      console.error(`[readPage] CURL Process Error: ${result.error.message}`);
    }
  } catch (e: any) {
    console.error(`[readPage] CURL Final Error: ${e.message}`);
  }

  return "";
}

/**
 * Fetches and parses JSON from a URL
 */
export async function readJson<T = any>(url: string): Promise<T | null> {
  try {
    const isAnimux = url.includes("animux.site");
    
    // For Animux, we need VERY specific headers to avoid getting HTML
    const headers: Record<string, string> = { 
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
    };

    if (isAnimux) {
      headers["Referer"] = "https://animux.site/canales";
      headers["Origin"] = "https://animux.site";
      headers["Sec-Ch-Ua"] = '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"';
      headers["Sec-Ch-Ua-Mobile"] = "?0";
      headers["Sec-Ch-Ua-Platform"] = '"Windows"';
      headers["Sec-Fetch-Dest"] = "empty";
      headers["Sec-Fetch-Mode"] = "cors";
      headers["Sec-Fetch-Site"] = "same-origin";
      headers["X-Requested-With"] = "XMLHttpRequest";
    }

    const text = await readPage(url, headers);
    if (!text) return null;
    
    // Safety check: if we got HTML instead of JSON, we might be getting a challenge
    // or the site is redirecting to home. Try to extract JSON from the text anyway.
    const isHtml = text.trim().toLowerCase().startsWith("<!doctype") || text.trim().toLowerCase().startsWith("<html");
    
    if (isHtml) {
      console.warn(`[readJson] Received HTML from ${url}. Attempting regex extraction...`);
    }

    try {
      // Direct parse if possible
      if (!isHtml) {
        return JSON.parse(text.trim()) as T;
      }
    } catch (e) {
      // Fall through to regex extraction
    }

    // Regex-based recovery for malformed or embedded payloads
    // We look for anything that looks like an array of objects or a large object
    const jsonMatch = text.match(/(\[\s*\{[\s\S]*\}\s*\]|\{\s*"channels"[\s\S]*\})/);
    if (jsonMatch) {
      try {
        console.log(`[readJson] Regex match found for ${url}, attempting to parse...`);
        return JSON.parse(jsonMatch[0]) as T;
      } catch (parseError) {
        console.warn(`[readJson] Regex match parse failed for ${url}`);
      }
    }

    // Even more aggressive extraction: find the longest string between [ ] or { }
    const allMatches = text.match(/\[[\s\S]*?\]|\{[\s\S]*?\}/g);
    if (allMatches) {
      const sortedMatches = allMatches.sort((a, b) => b.length - a.length);
      for (const match of sortedMatches) {
        if (match.length < 50) continue; // Skip small fragments
        try {
          const parsed = JSON.parse(match);
          if (Array.isArray(parsed) || parsed.channels || parsed.streams) {
            console.log(`[readJson] Aggressive match success for ${url} (length: ${match.length})`);
            return parsed as T;
          }
        } catch (e) {
          // Continue to next match
        }
      }
    }

    if (isHtml) return null;
    throw new Error("Could not parse JSON even with regex");
    
  } catch (e) {
    console.error(`[readJson] Error parsing JSON from ${url}:`, e);
    return null;
  }
}
