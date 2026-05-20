import { NextRequest, NextResponse } from "next/server";
import { readPage } from "@/lib/scrapers/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "pelispedia";
  const query = searchParams.get("query") || "Michael";

  const results: any = { action, query, timestamp: Date.now() };

  try {
    if (action === "pelispedia_search") {
      const url = `https://pelispedia.mov/search?s=${encodeURIComponent(query)}`;
      const html = await readPage(url, {}, true);
      results.url = url;
      results.htmlLength = html.length;
      results.htmlPreview = html.substring(0, 8000);
      results.hasDataLink = /dataLink/.test(html);
      results.dataLinkMatch = (html.match(/(?:let|const|var)\s+dataLink\s*=\s*\[[\s\S]*?\];/) || [])[0]?.substring(0, 3000) || null;
      
      // Extract search results
      const titles: string[] = [];
      const itemRegex = /movie-card[\s\S]*?href=["']([^"']+)["'][\s\S]*?<h4[^>]*>([^<]+)<\/h4>/g;
      let match;
      while ((match = itemRegex.exec(html)) !== null) {
        titles.push(`${match[2].trim()} → ${match[1]}`);
      }
      results.foundTitles = titles;
    }

    if (action === "pelispedia_page") {
      const slug = searchParams.get("slug") || query.toLowerCase().replace(/\s+/g, "-");
      const url = `https://pelispedia.mov/pelicula/${slug}/`;
      const html = await readPage(url, {}, true);
      results.url = url;
      results.htmlLength = html.length;
      results.htmlPreview = html.substring(0, 6000);
      
      // Check for dataLink patterns
      const dlRegex = /(?:let|const|var)\s+dataLink\s*=\s*(\[[\s\S]*?\]|\{[\s\S]*\});/;
      const dlMatch = dlRegex.exec(html);
      results.dataLinkRegexMatch = dlMatch ? dlMatch[0].substring(0, 2000) : null;
      
      // Check for dataLink via indexOf
      const idx = html.indexOf('dataLink');
      results.dataLinkIndex = idx;
      if (idx >= 0) {
        results.dataLinkContext = html.substring(Math.max(0, idx - 100), Math.min(html.length, idx + 3000));
      }
      
      // Search for API/player patterns
      results.apiPatterns = {
        fetchCalls: (html.match(/fetch\(["']([^"']+)["']\)/g) || []).slice(0, 5),
        ajaxCalls: (html.match(/\$\.(?:ajax|get|post|getJSON)\s*\(\s*["']([^"']+)["']/g) || []).slice(0, 5),
        playerDivs: (html.match(/<div[^>]+id="player-\d+"[^>]*>/g) || []),
        serverButtons: (html.match(/<button[^>]+class="[^"]*server[^"]*"[^>]*>/g) || []).slice(0, 6),
        embedUrls: (html.match(/https?:\/\/[^"'\s]*(?:embed|player|stream|voe|hglink|dood|filemoon|streamtape|mixdrop|uqload)[^"'\s]*/gi) || []).slice(0, 10),
        dataVar: (html.match(/(?:let|const|var)\s+\w+\s*=\s*["'][^"']*https?:[^"']+["']/g) || []).slice(0, 5),
      };
      
      // Find iframes
      const iframes: string[] = [];
      const iframeRegex2 = /<iframe[^>]+src=["']([^"']+)["']/gi;
      let iMatch2;
      while ((iMatch2 = iframeRegex2.exec(html)) !== null) {
        iframes.push(iMatch2[1]);
      }
      results.iframes = iframes;
      
      // Check body section for player content
      const bodyIdx = html.indexOf('<body');
      if (bodyIdx >= 0) {
        results.bodyPreview = html.substring(bodyIdx, Math.min(html.length, bodyIdx + 3000));
      }
    }

    if (action === "cuevana_search") {
      const url = `https://cuevana.biz/?s=${encodeURIComponent(query)}`;
      const html = await readPage(url, { Referer: "https://cuevana.biz/" }, true);
      results.url = url;
      results.htmlLength = html.length;
      results.htmlPreview = html.substring(0, 8000);
    }

    if (action === "cinecalidad_search") {
      const url = `https://www.cinecalidad.ro/?s=${encodeURIComponent(query)}`;
      const html = await readPage(url, { Referer: "https://www.cinecalidad.ro/" }, true);
      results.url = url;
      results.htmlLength = html.length;
      results.htmlPreview = html.substring(0, 8000);
    }

    if (action === "yandi_page") {
      const slug = searchParams.get("slug") || query.toLowerCase().replace(/\s+/g, "-");
      const url = `https://yandispoiler.net/pelicula/${slug}/`;
      const html = await readPage(url, {}, true);
      results.url = url;
      results.htmlLength = html.length;
      results.hasDataLink = /dataLink/.test(html);
      results.htmlPreview = html.substring(0, 6000);
      const iframes: string[] = [];
      const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
      let iMatch;
      while ((iMatch = iframeRegex.exec(html)) !== null) iframes.push(iMatch[1]);
      results.iframes = iframes;
    }

    if (action === "gnula_page") {
      const slug = searchParams.get("slug") || query.toLowerCase().replace(/\s+/g, "-");
      const url = `https://ww3.gnulahd.nu/pelicula/${slug}/`;
      const html = await readPage(url, {}, true);
      results.url = url;
      results.htmlLength = html.length;
      results.htmlPreview = html.substring(0, 6000);
      const iframes: string[] = [];
      const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
      let iMatch;
      while ((iMatch = iframeRegex.exec(html)) !== null) iframes.push(iMatch[1]);
      results.iframes = iframes;
    }

    if (action === "gnula_search") {
      const url = `https://ww3.gnulahd.nu/?s=${encodeURIComponent(query)}`;
      const html = await readPage(url, {}, true);
      results.url = url;
      results.htmlLength = html.length;
      results.htmlPreview = html.substring(0, 8000);
      const titles: string[] = [];
      const itemRegex = /<article[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/gi;
      let m;
      while ((m = itemRegex.exec(html)) !== null) {
        titles.push(`${m[2].trim()} → ${m[1]}`);
      }
      results.foundTitles = titles;
    }

    if (action === "yandi_search") {
      const url = `https://yandispoiler.net/?s=${encodeURIComponent(query)}`;
      const html = await readPage(url, {}, true);
      results.url = url;
      results.htmlLength = html.length;
      // Search for body content
      const bodyIdx = html.indexOf("<body");
      results.bodyStart = html.substring(bodyIdx > 0 ? bodyIdx : 0, Math.min(html.length, (bodyIdx > 0 ? bodyIdx : 0) + 15000));
      
      const titles: string[] = [];
      // Try multiple patterns
      const patterns = [
        /<a[^>]+href="([^"]+)"[^>]*title="([^"]+)"[^>]*>/gi,
        /<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
        /<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)/gi,
        /<img[^>]+alt="([^"]+)"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>/gi,
      ];
      for (const pattern of patterns) {
        let m;
        while ((m = pattern.exec(html)) !== null) {
          const url = m[1];
          const title = m[2];
          if (url && title && title.length > 2) titles.push(`${title.trim()} → ${url}`);
        }
        if (titles.length > 0) break;
      }
      results.foundTitles = titles.slice(0, 20);
    }

    if (action === "unlimplay") {
      // Fetch Unlimplay main page - get more content
      const r1 = await fetch("https://unlimplay.com/", { signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(() => "");
      results.unlimplayHomeFull = r1.length;
      // Extract body content after the large CSS block
      const bodyStart = r1.indexOf("<body");
      const mainStart = r1.indexOf("<main", bodyStart);
      results.unlimplayContent = r1.substring(mainStart > 0 ? mainStart : Math.max(0, r1.length - 8000), Math.min(r1.length, (mainStart > 0 ? mainStart : r1.length - 8000) + 10000));
      
      // Try different API endpoints
      // 1. Try with TMDB ID
      const a1 = await fetch("https://unlimplay.com/api/embed?type=movie&id=272", { signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(e => e.message);
      results.apiMovieById = a1.substring(0, 500);
      
      // 2. Try with TMDB ID as tmdb param
      const a2 = await fetch("https://unlimplay.com/api/embed?tmdb=272&type=movie", { signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(e => e.message);
      results.apiTmdb = a2.substring(0, 500);
      
      // 3. Try source endpoint with embed69 URL
      const a3 = await fetch("https://unlimplay.com/api/source?url=https://embed69.org/d/d67RS1d97vzBW4jHtMuDRG", { signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(e => e.message);
      results.apiSource = a3.substring(0, 1000);
      
      // 4. Try the API with search
      const a4 = await fetch("https://unlimplay.com/api/search?q=michael", { signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(e => e.message);
      results.apiSearch = a4.substring(0, 500);
    }

    if (action === "vidurl") {
      const vidId = searchParams.get("id") || "tt0372784";
      const url = `https://pelispedia.mov/vidurl/${vidId}/`;
      const html = await readPage(url, {}, true);
      results.url = url;
      results.htmlLength = html.length;
      results.bodyStart = html.substring(html.indexOf("<body"), Math.min(html.length, html.indexOf("<body") + 5000));
      const iframes: string[] = [];
      const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
      let m;
      while ((m = iframeRegex.exec(html)) !== null) {
        iframes.push(m[1]);
      }
      results.iframes = iframes;
      results.dataUrls = (html.match(/data-(?:url|src|link|embed)=["']([^"']+)["']/gi) || []).slice(0, 10);
      results.scriptUrls = (html.match(/(?:src|url|link|file)\s*[:=]\s*["'](https?:[^"']+)["']/gi) || []).slice(0, 10);
      // JWT / server data patterns
      results.hasDataLink = /dataLink/i.test(html);
      results.dataLinkMatches = (html.match(/dataLink[^;]*;/gi) || []).slice(0, 5);
      results.serverData = (html.match(/(?:servers|embeds|sources)\s*[:=]\s*(\[[^\]]*\])/gi) || []).slice(0, 5);
      // Check for script tags with large JSON
      const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
      results.scriptCount = scriptMatch.length;
      results.largeScripts = scriptMatch.filter(s => s.length > 500).slice(0, 3).map(s => s.substring(0, 1000));
    }

    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, results });
  }
}
