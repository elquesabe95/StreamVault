import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getMovieDetails, getTvDetails, tmdbImage } from "@/lib/tmdb";
import { searchPelispedia, getPelispediaSources, getPelispediaEpisodeUrl } from "@/lib/scrapers/pelispedia";
import { searchCuevana, getCuevanaSources, getCuevanaEpisodeUrl } from "@/lib/scrapers/cuevana";
import { searchCinecalidad, getCinecalidadSources, getCinecalidadEpisodeUrl } from "@/lib/scrapers/cinecalidad";
import { resolveStream } from "@/lib/scrapers/resolver";

type PlaybackType = "hls" | "mp4" | "iframe";
function getPlaybackType(url: string): PlaybackType {
  if (/\.m3u8(?:[?#].*)?$/i.test(url) || url.includes(".m3u8")) return "hls";
  if (/\.mp4(?:[?#].*)?$/i.test(url) || url.includes(".mp4")) return "mp4";
  return "iframe";
}

async function resolveDeep(url: string): Promise<string[]> {
  // Direct iframe hosts — pass through without resolution
  const directIframe = /voe\.sx|hglink\.to|bysedikamoum/.test(url);
  // Skip dead hosts  
  if (/minochinos/.test(url)) return [];
  
  const first = await resolveStream(url).catch(() => url);
  return Array.isArray(first) ? first.slice(0, 12) : [first];
}

export async function GET(req: NextRequest) {
  const start = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "movie";
    const id = parseInt(searchParams.get("id") || "0");
    const season = parseInt(searchParams.get("season") || "1");
    const episode = parseInt(searchParams.get("episode") || "1");

    if (!id) {
      return NextResponse.json({ success: false, message: "id requerido" }, { status: 400 });
    }

    // 1. TMDB metadata (fast)
    let metadata: any = {};
    let query = "";

    if (type === "movie") {
      const movie = await getMovieDetails(id);
      metadata = {
        id: movie.id, title: movie.title,
        poster: tmdbImage(movie.poster_path),
        backdrop: tmdbImage(movie.backdrop_path, "w1280"),
        year: movie.release_date?.substring(0, 4) || "",
        rating: movie.vote_average, runtime: movie.runtime,
      };
      query = movie.title;
    } else {
      const show = await getTvDetails(id);
      metadata = {
        id: show.id, title: show.name,
        poster: tmdbImage(show.poster_path),
        backdrop: tmdbImage(show.backdrop_path, "w1280"),
        year: show.first_air_date?.substring(0, 4) || "",
        rating: show.vote_average, season, episode,
      };
      query = show.name;
    }

    // 2. Scrape sources from Spanish-language providers
    const findExactMatch = (results: any[]) => {
      if (!results?.length) return null;
      const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const norm = (t: string) => t.replace(/&#39;/g, "'").replace(/&amp;/g, "&").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      // Exact match
      const exact = results.find((r: any) => norm(r.title) === q);
      if (exact) return exact;
      // Word-boundary match — but reject if title is way longer than query (false positive)
      const wordRegex = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      const wordMatch = results.find((r: any) => {
        const t = norm(r.title);
        if (!wordRegex.test(t)) return false;
        // If query is short and title is much longer, it's probably a false match
        if (q.length <= 5 && t.length > q.length * 3) return false;
        return true;
      });
      if (wordMatch) return wordMatch;
      // Fallback: only if query is long enough and found something reasonable
      if (q.length > 5) {
        const partial = results.find((r: any) => { const t = norm(r.title); return t.includes(q) || q.includes(t); });
        if (partial) return partial;
      }
      return null; // No match found — skip this provider
    };

    // Build slug from title for direct URL fallback
    const slugTitle = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const providers = [
      {
        name: "CineCalidad",
        fn: async () => {
          const res = await searchCinecalidad(query);
          let match = findExactMatch(res);
          let targetUrl = match?.url || (type === "movie" ? "" : "");
          if (!match) {
            targetUrl = type === "movie"
              ? `https://www.cinecalidad.ro/pelicula/${slugTitle}/`
              : `https://www.cinecalidad.ro/serie/${slugTitle}/temporada/${season}/capitulo/${episode}`;
          } else if (type !== "movie") {
            const epUrl = await getCinecalidadEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl; else return [];
          }
          if (!targetUrl) return [];
          const sources = await getCinecalidadSources(targetUrl);
          return sources.map((s: any) => ({ ...s, lang: s.lang === "latino" ? "Latino" : s.lang === "spanish" ? "Castellano" : "Sub" }));
        },
      },
      {
        name: "Cuevana",
        fn: async () => {
          const res = await searchCuevana(query);
          let match = findExactMatch(res);
          let targetUrl = match?.url || "";
          if (!match) {
            targetUrl = type === "movie"
              ? `https://cuevana.biz/pelicula/${slugTitle}/`
              : `https://cuevana.biz/serie/${slugTitle}/temporada/${season}/capitulo/${episode}`;
          } else if (type !== "movie") {
            const epUrl = await getCuevanaEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl; else return [];
          }
          if (!targetUrl) return [];
          const sources = await getCuevanaSources(targetUrl);
          return sources.map((s: any) => ({ ...s, lang: s.lang === "latino" ? "Latino" : s.lang === "spanish" ? "Castellano" : "Sub" }));
        },
      },
      {
        name: "PelisPedia",
        fn: async () => {
          const res = await searchPelispedia(query);
          let match = findExactMatch(res);
          let targetUrl = match?.url || "";
          if (!match) {
            targetUrl = type === "movie"
              ? `https://pelispedia.mov/pelicula/${slugTitle}/`
              : `https://pelispedia.mov/serie/${slugTitle}/temporada/${season}/capitulo/${episode}`;
          } else if (type !== "movie") {
            const epUrl = await getPelispediaEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl; else return [];
          }
          if (!targetUrl) return [];
          const sources = await getPelispediaSources(targetUrl);
          return sources.map((s: any) => ({ ...s, lang: "Latino" }));
        },
      },
    ];

    const finalSources: any[] = [];
    const seen = new Set<string>();
    let count = 1;

    // Timeout wrapper — slow providers won't block the response
    const withTimeout = <T>(p: Promise<T>, ms: number, name: string): Promise<T> =>
      Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${name} timeout`)), ms))]);

    // Run all providers in parallel with individual timeouts
    const allResults = await Promise.allSettled(
      providers.map(p => withTimeout(p.fn().catch(() => []), 12000, p.name))
    );

    for (const r of allResults) {
      if (r.status !== "fulfilled") continue;
      const providerName = providers[allResults.indexOf(r)]?.name || "?";
      for (const item of r.value) {
        const rawUrl = item.url || item.remote;
        if (!rawUrl) continue;

        const urls = await resolveDeep(rawUrl);
        for (const u of urls) {
          if (seen.has(u)) continue;
          seen.add(u);

          const lang = item.lang === "spanish" ? "Castellano" :
            item.lang === "subbed" ? "Sub" : "Latino";

          finalSources.push({
            url: u,
            name: `${providerName} ${count++}`,
            lang,
            playbackType: getPlaybackType(u),
          });
        }
      }
    }

    console.log(`[EmbedServe] ${metadata.title} — ${finalSources.length} sources in ${Date.now() - start}ms`);

    return NextResponse.json({
      success: true,
      _v: 3,
      data: { type, ...metadata, sources: finalSources },
    });

  } catch (error) {
    console.error("[EmbedServe] Fatal", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
