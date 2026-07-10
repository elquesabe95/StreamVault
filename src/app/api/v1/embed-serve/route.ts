import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 25;

import { getMovieDetails, getTvDetails, tmdbImage } from "@/lib/tmdb";
import { searchPelispedia, getPelispediaSources, getPelispediaEpisodeUrl } from "@/lib/scrapers/pelispedia";
import { searchCuevana, getCuevanaSources, getCuevanaEpisodeUrl } from "@/lib/scrapers/cuevana";
import { searchCinecalidad, getCinecalidadSources, getCinecalidadEpisodeUrl } from "@/lib/scrapers/cinecalidad";
import { searchGnula, getGnulaSources, getGnulaEpisodeUrl } from "@/lib/scrapers/gnula";
import { searchYandi, getYandiSources, getYandiEpisodeUrl } from "@/lib/scrapers/yandispoiler";
import { resolveStream } from "@/lib/scrapers/resolver";

type PlaybackType = "hls" | "mp4" | "iframe";

function getPlaybackType(url: string): PlaybackType {
  if (/\.m3u8(?:[?#].*)?$/i.test(url) || url.includes(".m3u8")) return "hls";
  if (/\.mp4(?:[?#].*)?$/i.test(url) || url.includes(".mp4")) return "mp4";
  return "iframe";
}

// ── In-memory cache ────────────────────────────────────────────────────────────
interface CacheEntry { sources: any[]; ts: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 25 * 60 * 1000;

function getCached(key: string): any[] | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return e.sources;
}
function setCached(key: string, sources: any[]) {
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { sources, ts: Date.now() });
}

// ── Two-level resolver (mirrors the /scraper route's resolveToPlayableUrls) ───
// Level 1: resolve the raw scraper URL (e.g. vidurl → array of embed iframes)
// Level 2: resolve each remaining iframe (e.g. streamwish → m3u8)
async function resolveDeep(url: string, ms = 4500): Promise<string[]> {
  if (/minochinos|short\.icu|earnvids/i.test(url)) return [];

  const timer = <T>(t: number, v: T): Promise<T> => new Promise(r => setTimeout(() => r(v), t));

  // Level 1
  const first = await Promise.race([
    resolveStream(url).catch((): string => url),
    timer(ms, url as string),
  ]);
  const firstUrls: string[] = Array.isArray(first) ? first.slice(0, 10) : [first as string];

  // Level 2: for any result that is still an iframe, try to extract a stream
  const playable: string[] = [];
  await Promise.all(
    firstUrls.map(async (u) => {
      if (/minochinos|short\.icu|earnvids/i.test(u)) return;
      const pt = /\.m3u8(?:[?#]|$)/i.test(u) ? "hls" : /\.mp4(?:[?#]|$)/i.test(u) ? "mp4" : "iframe";
      if (pt !== "iframe") { playable.push(u); return; }
      // Pass known iframe-only hosts through unchanged
      if (/voe\.sx|hglink\.to/i.test(u)) { playable.push(u); return; }
      const second = await Promise.race([
        resolveStream(u).catch((): string => u),
        timer(ms, u as string),
      ]);
      const secondUrls: string[] = Array.isArray(second) ? second.slice(0, 5) : [second as string];
      playable.push(...secondUrls);
    })
  );

  return [...new Set(playable)].slice(0, 12);
}

export async function GET(req: NextRequest) {
  const start = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "movie";
    const id = parseInt(searchParams.get("id") || "0");
    const season = parseInt(searchParams.get("season") || "1");
    const episode = parseInt(searchParams.get("episode") || "1");

    if (!id) return NextResponse.json({ success: false, message: "id requerido" }, { status: 400 });

    const cacheKey = `${type}:${id}:${season}:${episode}`;

    // ── 1. TMDB metadata ──────────────────────────────────────────────────────
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

    // ── 2. Cache hit ──────────────────────────────────────────────────────────
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[EmbedServe] CACHE HIT ${metadata.title} in ${Date.now() - start}ms`);
      return NextResponse.json({ success: true, _v: 9, cached: true, data: { type, ...metadata, sources: cached } });
    }

    // ── 3. Provider definitions ───────────────────────────────────────────────
    const year = metadata.year || "";
    const slug = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const findMatch = (results: any[]) => {
      if (!results?.length) return null;
      const q = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
      const norm = (t: string) => t.replace(/&#39;/g, "'").replace(/&amp;/g, "&")
        .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
      const exact = results.find((r: any) => norm(r.title) === q);
      if (exact) return exact;
      const re = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (year) return results.find((r: any) => re.test(norm(r.title)) && r.title.includes(year)) || null;
      const wm = results.find((r: any) => { const t = norm(r.title); return re.test(t) && !(q.length <= 5 && t.length > q.length * 3); });
      if (wm) return wm;
      return q.length > 5 ? (results.find((r: any) => { const t = norm(r.title); return t.includes(q) || q.includes(t); }) || null) : null;
    };

    type RawItem = { url: string; lang?: string };

    const providers: { name: string; fn: () => Promise<RawItem[]> }[] = [
      {
        name: "PelisPedia",
        fn: async () => {
          const res = await searchPelispedia(query);
          const match = findMatch(res);
          let targetUrl = match?.url || (type === "movie"
            ? `https://pelispedia.mov/pelicula/${slug}/`
            : `https://pelispedia.mov/serie/${slug}/temporada/${season}/capitulo/${episode}`);
          if (match && type !== "movie") {
            const ep = await getPelispediaEpisodeUrl(match.url, season, episode);
            if (ep) targetUrl = ep; else return [];
          }
          const s = await getPelispediaSources(targetUrl);
          return s.map((x: any) => ({ ...x, lang: "Latino" }));
        },
      },
      {
        name: "Gnula",
        fn: async () => {
          const res = await searchGnula(query);
          const match = findMatch(res);
          let targetUrl = match?.url || `https://ww3.gnulahd.nu/ver/${slug}/`;
          if (match && type !== "movie") {
            const ep = await getGnulaEpisodeUrl(match.url, season, episode);
            if (ep) targetUrl = ep; else return [];
          }
          const s = await getGnulaSources(targetUrl);
          return s.map((x: any) => ({ ...x, lang: "Latino" }));
        },
      },
      {
        name: "Cuevana",
        fn: async () => {
          const res = await searchCuevana(query);
          const match = findMatch(res);
          let targetUrl = match?.url || (type === "movie"
            ? `https://cuevana.biz/pelicula/${slug}/`
            : `https://cuevana.biz/serie/${slug}/temporada/${season}/capitulo/${episode}`);
          if (match && type !== "movie") {
            const ep = await getCuevanaEpisodeUrl(match.url, season, episode);
            if (ep) targetUrl = ep; else return [];
          }
          const s = await getCuevanaSources(targetUrl);
          return s.map((x: any) => ({
            ...x,
            lang: x.lang === "spanish" ? "Castellano" : x.lang === "subbed" ? "Sub" : "Latino",
          }));
        },
      },
      {
        name: "YandiSpoiler",
        fn: async () => {
          const res = await searchYandi(query);
          const match = findMatch(res);
          let targetUrl = match?.url || (type === "movie"
            ? `https://yandispoiler.net/pelicula/${slug}/`
            : `https://yandispoiler.net/serie/${slug}/temporada/${season}/capitulo/${episode}`);
          if (match && type !== "movie") {
            const ep = await getYandiEpisodeUrl(match.url, season, episode);
            if (ep) targetUrl = ep; else return [];
          }
          const s = await getYandiSources(targetUrl);
          return s.map((x: any) => ({ ...x, lang: "Latino" }));
        },
      },
      {
        name: "CineCalidad",
        fn: async () => {
          const res = await searchCinecalidad(query);
          const match = findMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          if (type !== "movie") {
            const ep = await getCinecalidadEpisodeUrl(match.url, season, episode);
            if (ep) targetUrl = ep; else return [];
          }
          const s = await getCinecalidadSources(targetUrl);
          return s.map((x: any) => ({ ...x, lang: "Latino" }));
        },
      },
    ];

    // ── 4. Run all providers + resolve in parallel (correct pattern) ──────────
    // Each provider promise includes scraping AND resolving its own URLs.
    // This means as soon as provider A finishes, its URLs start resolving
    // WITHOUT waiting for provider B, C, D...
    const PROVIDER_TIMEOUT = 5000;
    const RESOLVE_TIMEOUT = 4000;

    const timeout = <T>(ms: number, fallback: T): Promise<T> =>
      new Promise(r => setTimeout(() => r(fallback), ms));

    const allProviderResults = await Promise.allSettled(
      providers.map(async p => {
        const items: RawItem[] = await Promise.race([
          p.fn().catch((): RawItem[] => []),
          timeout(PROVIDER_TIMEOUT, [] as RawItem[]),
        ]);

        // Immediately resolve all URLs from this provider in parallel
        const resolved = await Promise.all(
          items.map(async item => {
            if (!item.url) return [];
            const lang = item.lang === "spanish" ? "Castellano"
              : item.lang === "subbed" ? "Sub"
              : item.lang || "Latino";
            const urls = await Promise.race([
              resolveDeep(item.url, RESOLVE_TIMEOUT),
              timeout(RESOLVE_TIMEOUT + 500, [item.url]),
            ]);
            return urls.map((u: string) => ({ providerName: p.name, url: u, lang }));
          })
        );

        return resolved.flat();
      })
    );

    // ── 5. Deduplicate and sort ───────────────────────────────────────────────
    const seen = new Set<string>();
    let count = 1;
    const finalSources: any[] = [];

    for (const r of allProviderResults) {
      if (r.status !== "fulfilled") continue;
      for (const { providerName, url: u, lang } of r.value) {
        if (!u || seen.has(u)) continue;
        if (/minochinos|earnvids|short\.icu/i.test(u)) continue;
        if (/youtube\.com|youtu\.be/i.test(u)) continue;
        seen.add(u);
        finalSources.push({ url: u, name: `${providerName} ${count++}`, lang, playbackType: getPlaybackType(u) });
      }
    }

    const rank: Record<PlaybackType, number> = { hls: 0, mp4: 1, iframe: 2 };
    finalSources.sort((a, b) => rank[a.playbackType as PlaybackType] - rank[b.playbackType as PlaybackType]);

    // ── 6. Proxy HLS/MP4 so IP-locked CDN tokens work from browser ───────────
    const origin = new URL(req.url).origin;
    const proxyBase = `${origin}/api/v1/proxy`;

    const proxiedSources = finalSources.map(s => {
      if (s.playbackType === "hls" || s.playbackType === "mp4") {
        return { ...s, url: `${proxyBase}?${new URLSearchParams({ url: s.url })}`, originalUrl: s.url };
      }
      return s;
    });

    if (proxiedSources.length > 0) setCached(cacheKey, proxiedSources);

    console.log(`[EmbedServe] ${metadata.title} — ${proxiedSources.length} sources in ${Date.now() - start}ms`);

    return NextResponse.json({
      success: true,
      _v: 9,
      data: { type, ...metadata, sources: proxiedSources },
    });

  } catch (error) {
    console.error("[EmbedServe] Fatal", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
