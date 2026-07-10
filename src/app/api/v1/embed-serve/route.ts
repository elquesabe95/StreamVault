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

// ── In-memory cache — version-stamped so deploys start fresh ──────────────────
const CACHE_VERSION = "v11";
interface CacheEntry { sources: any[]; ts: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 20 * 60 * 1000; // 20 min

function getCached(key: string): any[] | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return e.sources;
}
function setCached(key: string, sources: any[]) {
  if (sources.length === 0) return; // never cache empty results
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { sources, ts: Date.now() });
}

// ── Two-level resolver — mirrors /scraper's resolveToPlayableUrls exactly ─────
// No per-step timeouts here; the provider-level timeout wraps everything.
async function resolveToPlayable(rawUrl: string): Promise<string[]> {
  if (/minochinos|short\.icu|earnvids/i.test(rawUrl)) return [];

  // Level 1
  const first = await resolveStream(rawUrl).catch(() => rawUrl);
  const firstUrls: string[] = Array.isArray(first) ? first.slice(0, 10) : [first];

  // Level 2: for iframes, try one more resolution pass in parallel
  const results = await Promise.all(
    firstUrls.map(async (u) => {
      if (/minochinos|short\.icu|earnvids/i.test(u)) return [];
      const pt = getPlaybackType(u);
      if (pt !== "iframe") return [u]; // already a stream
      // Pass known iframe-only hosts through
      if (/voe\.sx|hglink\.to/i.test(u)) return [u];
      const second = await resolveStream(u).catch(() => u);
      return Array.isArray(second) ? second.slice(0, 5) : [second];
    })
  );

  return [...new Set(results.flat())].slice(0, 15);
}

export async function GET(req: NextRequest) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "movie";
    const id = parseInt(searchParams.get("id") || "0");
    const season = parseInt(searchParams.get("season") || "1");
    const episode = parseInt(searchParams.get("episode") || "1");
    const nocache = searchParams.get("nocache") === "1";

    if (!id) return NextResponse.json({ success: false, message: "id requerido" }, { status: 400 });

    const cacheKey = `${CACHE_VERSION}:${type}:${id}:${season}:${episode}`;

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
    if (!nocache) {
      const cached = getCached(cacheKey);
      if (cached) {
        console.log(`[EmbedServe] CACHE HIT ${metadata.title} in ${Date.now() - start}ms`);
        return NextResponse.json({ success: true, _v: 10, cached: true, data: { type, ...metadata, sources: cached } });
      }
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

    // ── 4. Race providers — return as soon as ANY provider finds HLS streams ──
    // Hard ceiling: 8 seconds total (Vercel Hobby allows 10s max).
    const RESPONSE_DEADLINE = 8000;

    const seen = new Set<string>();
    let count = 1;
    const finalSources: any[] = [];
    let hasDirectStream = false;

    // Seed with guaranteed fallback iframes so the player never shows a blank
    // error screen. Scraped HLS sources sort first and will play before these.
    const fbUrls =
      type === "movie"
        ? [
            `https://vidsrc.xyz/embed/movie/${id}`,
            `https://vidsrc.to/embed/movie/${id}`,
            `https://embed.su/embed/movie/${id}`,
          ]
        : [
            `https://vidsrc.xyz/embed/tv/${id}/${season}/${episode}`,
            `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`,
            `https://embed.su/embed/tv/${id}/${season}/${episode}`,
          ];
    for (const url of fbUrls) {
      seen.add(url);
      finalSources.push({ url, name: `Respaldo ${count++}`, lang: "EN", playbackType: "iframe" });
    }

    // earlyResolve fires when we have at least one HLS source
    let earlyResolve!: () => void;
    const earlyDone = new Promise<void>(r => { earlyResolve = r; });

    const addSources = (items: { providerName: string; url: string; lang: string }[]) => {
      for (const { providerName, url: u, lang } of items) {
        if (!u || seen.has(u)) continue;
        if (/minochinos|earnvids|short\.icu|youtube\.com|youtu\.be/i.test(u)) continue;
        seen.add(u);
        const pt = getPlaybackType(u);
        finalSources.push({ url: u, name: `${providerName} ${count++}`, lang, playbackType: pt });
        if ((pt === "hls" || pt === "mp4") && !hasDirectStream) {
          hasDirectStream = true;
          earlyResolve(); // ← signal: have a direct stream, respond now
        }
      }
    };

    // After 5 s without HLS fire early with whatever we have (at least fallback iframes)
    const midTimer = setTimeout(earlyResolve, 5000);

    // Fire all providers simultaneously; each signals when done
    const providerRuns = providers.map(async p => {
      try {
        const items: RawItem[] = await p.fn().catch(() => []);
        const resolved = await Promise.all(
          items.map(async item => {
            if (!item.url) return [];
            const lang = item.lang === "spanish" ? "Castellano"
              : item.lang === "subbed" ? "Sub"
              : item.lang || "Latino";
            const urls = await resolveToPlayable(item.url);
            return urls.map(u => ({ providerName: p.name, url: u, lang }));
          })
        );
        addSources(resolved.flat());
      } catch {}
    });

    // Wait for first HLS source, 5s mid-timer, OR hard deadline
    await Promise.race([
      earlyDone,
      new Promise<void>(r => setTimeout(r, RESPONSE_DEADLINE)),
    ]);
    clearTimeout(midTimer);

    // Let remaining providers keep running in background for a bit
    // (they may finish before Vercel kills the function, enriching cache)
    void Promise.race([
      Promise.allSettled(providerRuns).then(() => {
        if (finalSources.length > 0) {
          const rank: Record<PlaybackType, number> = { hls: 0, mp4: 1, iframe: 2 };
          finalSources.sort((a, b) => rank[a.playbackType as PlaybackType] - rank[b.playbackType as PlaybackType]);
        }
      }),
      new Promise(r => setTimeout(r, 5000)), // max 5 more seconds background
    ]);

    const rank: Record<PlaybackType, number> = { hls: 0, mp4: 1, iframe: 2 };
    finalSources.sort((a, b) => rank[a.playbackType as PlaybackType] - rank[b.playbackType as PlaybackType]);

    // ── 6. Proxy HLS/MP4 through our Node.js server (same AWS IP as scraper) ─
    const origin = new URL(req.url).origin;
    const proxyBase = `${origin}/api/v1/proxy`;

    const proxiedSources = finalSources.map(s => {
      if (s.playbackType === "hls" || s.playbackType === "mp4") {
        return { ...s, url: `${proxyBase}?${new URLSearchParams({ url: s.url })}`, originalUrl: s.url };
      }
      return s;
    });

    // Only cache if we got at least 1 direct stream
    const hasStream = proxiedSources.some(s => s.playbackType !== "iframe");
    if (hasStream) setCached(cacheKey, proxiedSources);

    console.log(`[EmbedServe] ${metadata.title} — ${proxiedSources.length} sources (${proxiedSources.filter(s=>s.playbackType==="hls").length} HLS) in ${Date.now() - start}ms`);

    return NextResponse.json({
      success: true,
      _v: 10,
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
