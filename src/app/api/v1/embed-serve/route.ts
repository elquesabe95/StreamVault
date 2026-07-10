import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getMovieDetails, getTvDetails, tmdbImage } from "@/lib/tmdb";
import { searchPelispedia, getPelispediaSources, getPelispediaEpisodeUrl } from "@/lib/scrapers/pelispedia";
import { searchCuevana, getCuevanaSources, getCuevanaEpisodeUrl } from "@/lib/scrapers/cuevana";
import { searchCinecalidad, getCinecalidadSources, getCinecalidadEpisodeUrl } from "@/lib/scrapers/cinecalidad";
import { searchGnula, getGnulaSources, getGnulaEpisodeUrl } from "@/lib/scrapers/gnula";
import { searchYandi, getYandiSources, getYandiEpisodeUrl } from "@/lib/scrapers/yandispoiler";
import { searchJuanita, getJuanitaSources, getJuanitaEpisodeUrl } from "@/lib/scrapers/pelisjuanita";
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
  if (/minochinos|short\.icu/i.test(url)) return [];
  if (directIframe) return [url];
  
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
    const year = metadata.year || "";
    const findExactMatch = (results: any[]) => {
      if (!results?.length) return null;
      const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const norm = (t: string) => t.replace(/&#39;/g, "'").replace(/&amp;/g, "&").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      // 1. Exact title match
      const exact = results.find((r: any) => norm(r.title) === q);
      if (exact) return exact;
      // 2. Exact title match on original casing
      const exactOrig = results.find((r: any) => r.title.toLowerCase().trim() === query.toLowerCase().trim());
      if (exactOrig) return exactOrig;
      // 3. Word-boundary match — require year when available to avoid false matches
      const wordRegex = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (year) {
        // With year: only return if result title contains the year
        const wordYear = results.find((r: any) => {
          const t = norm(r.title);
          if (!wordRegex.test(t)) return false;
          if (q.length <= 5 && t.length > q.length * 3) return false;
          return r.title.includes(year);
        });
        if (wordYear) return wordYear;
        // If we have year but no result matches, return null — don't guess
        return null;
      }
      // Without year: word-boundary match with short-query rejection
      const wordMatch = results.find((r: any) => {
        const t = norm(r.title);
        if (!wordRegex.test(t)) return false;
        if (q.length <= 5 && t.length > q.length * 3) return false;
        return true;
      });
      if (wordMatch) return wordMatch;
      // Last resort: partial match for long queries
      if (q.length > 5) {
        const partial = results.find((r: any) => { const t = norm(r.title); return t.includes(q) || q.includes(t); });
        if (partial) return partial;
      }
      return null;
    };

    // Build slug from title for direct URL fallback
    const slugTitle = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const providers = [
      {
        name: "YandiSpoiler",
        fn: async () => {
          const res = await searchYandi(query);
          let match = findExactMatch(res);
          let targetUrl = match?.url || "";
          if (!match) {
            targetUrl = type === "movie"
              ? `https://yandispoiler.net/pelicula/${slugTitle}/`
              : `https://yandispoiler.net/serie/${slugTitle}/temporada/${season}/capitulo/${episode}`;
          } else if (type !== "movie") {
            const epUrl = await getYandiEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl; else return [];
          }
          if (!targetUrl) return [];
          const sources = await getYandiSources(targetUrl);
          return sources.map((s: any) => ({ ...s, lang: "Latino" }));
        },
      },
      {
        name: "Gnula",
        fn: async () => {
          const res = await searchGnula(query);
          let match = findExactMatch(res);
          let targetUrl = match?.url || "";
          if (!match) {
            targetUrl = type === "movie"
              ? `https://ww3.gnulahd.nu/ver/${slugTitle}/`
              : `https://ww3.gnulahd.nu/ver/${slugTitle}/`;
          } else if (type !== "movie") {
            const epUrl = await getGnulaEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl; else return [];
          }
          if (!targetUrl) return [];
          const sources = await getGnulaSources(targetUrl);
          return sources.map((s: any) => ({ ...s, lang: "Latino" }));
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
      providers.map(p => withTimeout(p.fn().catch(() => []), 5000, p.name))
    );

    for (let pi = 0; pi < allResults.length; pi++) {
      const r = allResults[pi];
      if (r.status !== "fulfilled") continue;
      const providerName = providers[pi]?.name || "?";
      
      // Resolve all source URLs in parallel
      const resolved = await Promise.all(
        r.value.map(async (item: any) => {
          const rawUrl = item.url || item.remote;
          if (!rawUrl) return { urls: [] as string[], lang: "Latino" };
          const urls = await resolveDeep(rawUrl);
          const lang = item.lang === "spanish" ? "Castellano" :
            item.lang === "subbed" ? "Sub" : "Latino";
          return { urls, lang };
        })
      );
      
      for (const { urls, lang } of resolved) {
        for (const u of urls) {
          if (seen.has(u)) continue;
          seen.add(u);

          finalSources.push({
            url: u,
            name: `${providerName} ${count++}`,
            lang,
            playbackType: getPlaybackType(u),
          });
        }
      }
    }

    // Wrap HLS/MP4 URLs through proxy so CDN IP-locked tokens work from the browser.
    // Vercel (AWS) fetches them, same IP as where the token was minted.
    const baseUrl = new URL(req.url);
    const proxyBase = `${baseUrl.origin}/api/v1/proxy`;

    const proxiedSources = finalSources.map(s => {
      if (s.playbackType === "hls" || s.playbackType === "mp4") {
        const params = new URLSearchParams({ url: s.url });
        return { ...s, url: `${proxyBase}?${params.toString()}`, originalUrl: s.url };
      }
      return s;
    });

    // Safety net: strip dead hosts and YouTube embeds
    const safeSources = proxiedSources.filter(s => !/minochinos|earnvids|short\.icu/i.test(s.originalUrl || s.url) && !/youtube\.com|youtu\.be/i.test(s.url));

    // Prioritize direct streams (hls > mp4) over site iframes so the client
    // defaults to our own player whenever a direct source exists. Array.sort is
    // stable, so provider order is preserved within each playbackType group.
    const playbackRank: Record<PlaybackType, number> = { hls: 0, mp4: 1, iframe: 2 };
    safeSources.sort((a, b) => playbackRank[a.playbackType as PlaybackType] - playbackRank[b.playbackType as PlaybackType]);

    console.log(`[EmbedServe] ${metadata.title} — ${safeSources.length} sources in ${Date.now() - start}ms`);

    return NextResponse.json({
      success: true,
      _v: 7,
      data: { type, ...metadata, sources: safeSources },
    });

  } catch (error) {
    console.error("[EmbedServe] Fatal", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
