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
      results.htmlPreview = html.substring(0, 8000);
    }

    if (action === "unlimplay") {
      // Fetch Unlimplay main page
      const r1 = await fetch("https://unlimplay.com/", { signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(() => "");
      results.unlimplayHome = r1.substring(0, 5000);
      
      // Try their API
      const r2 = await fetch("https://unlimplay.com/api/embed?url=https://embed69.org/d/d67RS1d97vzBW4jHtMuDRG", { signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(() => "");
      results.unlimplayApi1 = r2.substring(0, 3000);
      
      // Try player endpoint
      const r3 = await fetch("https://unlimplay.com/player?url=https://embed69.org/d/d67RS1d97vzBW4jHtMuDRG", { signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(() => "");
      results.unlimplayPlayer = r3.substring(0, 3000);
      
      // Try source endpoint
      const r4 = await fetch("https://unlimplay.com/source?url=https://embed69.org/d/d67RS1d97vzBW4jHtMuDRG", { signal: AbortSignal.timeout(10000) }).then(r => r.text()).catch(() => "");
      results.unlimplaySource = r4.substring(0, 3000);
      
      // Try forobeta forum
      const r5 = await fetch("https://forobeta.com/temas/cohete-presentamos-el-recolector-de-enlaces-de-unlimplay.1091390/", { 
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      }).then(r => r.text()).catch(() => "");
      results.forobetaPreview = r5.substring(0, 10000);
    }

    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, results });
  }
}
