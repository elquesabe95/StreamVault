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
      results.htmlPreview = html.substring(0, 8000);
      
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
      
      // Find iframes
      const iframes: string[] = [];
      const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
      let iMatch;
      while ((iMatch = iframeRegex.exec(html)) !== null) {
        iframes.push(iMatch[1]);
      }
      results.iframes = iframes;
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

    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, results });
  }
}
