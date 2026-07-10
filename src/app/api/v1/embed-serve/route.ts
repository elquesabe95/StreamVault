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

// ── In-memory cache (survives between requests on same Vercel instance) ────────
interface CacheEntry { sources: any[]; ts: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 25 * 60 * 1000; // 25 min

function getCached(key: string): any[] | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return e.sources;
}
function setCached(key: string, sources: any[]) {
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { sources, ts: Date.now() });
}

// ── Resolver with per-URL timeout ──────────────────────────────────────────────
async function resolveDeep(url: string, ms = 4000): Promise<string[]> {
  if (/minochinos|short\.icu|earnvids/i.test(url)) return [];
  if (/voe\.sx|hglink\.to/i.test(url)) return [url]; // fast iframe pass-through
  const timer = new Promise<string[]>((_, r) => setTimeout(() => r([url]), ms));
  const work = resolveStream(url).catch(() => url);
  const first = await Promise.race([work, timer]);
  return Array.isArray(first) ? first.slice(0, 8) : [first];
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
    const cached = getCached(cacheKey);

    // ── 1. TMDB metadata (always fresh) ──────────────────────────────────────
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

    // ── 2. Serve from cache if available ─────────────────────────────────────
    if (cached) {
      console.log(`[EmbedServe] Cache HIT ${metadata.title} (${cacheKey}) in ${Date.now() - start}ms`);
      return NextResponse.json({ success: true, _v: 8, cached: true, data: { type, ...metadata, sources: cached } });
    }

    // ── 3. Scrape providers ───────────────────────────────────────────────────
    const year = metadata.year || "";

    const findMatch = (results: any[]) => {
      if (!results?.length) return null;
      const q = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
      const norm = (t: string) => t.replace(/&#39;/g, "'").replace(/&amp;/g, "&")
        .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
      const exact = results.find((r: any) => norm(r.title) === q);
      if (exact) return exact;
      const wordRegex = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (year) {
        const wy = results.find((r: any) => wordRegex.test(norm(r.title)) && r.title.includes(year));
        return wy || null;
      }
      const wm = results.find((r: any) => { const t = norm(r.title); return wordRegex.test(t) && !(q.length <= 5 && t.length > q.length * 3); });
      if (wm) return wm;
      if (q.length > 5) return results.find((r: any) => { const t = norm(r.title); return t.includes(q) || q.includes(t); }) || null;
      return null;
    };

    const slug = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Each provider returns raw { url, lang? } items
    type RawItem = { url: string; lang?: string };
    const providers: { name: string; fn: () => Promise<RawItem[]> }[] = [
      {
        name: "PelisPedia",
        fn: async () => {
          const res = await searchPelispedia(query);
          let match = findMatch(res);
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
          let match = findMatch(res);
          let targetUrl = match?.url || (type === "movie"
            ? `https://ww3.gnulahd.nu/ver/${slug}/`
            : `https://ww3.gnulahd.nu/ver/${slug}/`);
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
          let match = findMatch(res);
          let targetUrl = match?.url || (type === "movie"
            ? `https://cuevana.biz/pelicula/${slug}/`
            : `https://cuevana.biz/serie/${slug}/temporada/${season}/capitulo/${episode}`);
          if (match && type !== "movie") {
            const ep = await getCuevanaEpisodeUrl(match.url, season, episode);
            if (ep) targetUrl = ep; else return [];
          }
          const s = await getCuevanaSources(targetUrl);
          return s.map((x: any) => ({
            ...x, lang: x.lang === "spanish" ? "Castellano" : x.lang === "subbed" ? "Sub" : "Latino",
          }));
        },
      },
      {
        name: "YandiSpoiler",
        fn: async () => {
          const res = await searchYandi(query);
          let match = findMatch(res);
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
          let match = findMatch(res);
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

    // ── 4. Run all providers + resolve ALL urls fully in parallel ─────────────
    const PROVIDER_TIMEOUT = 5000;
    const RESOLVE_TIMEOUT = 4000;

    // Kick off all providers simultaneously
    const providerPromises = providers.map(p =>
      Promise.race([
        p.fn().catch((): RawItem[] => []),
        new Promise<RawItem[]>(res => setTimeout(() => res([]), PROVIDER_TIMEOUT)),
      ]).then(items => ({ name: p.name, items }))
    );

    // As each provider finishes, immediately start resolving its URLs
    // We flatten everything into one big parallel array
    const allResolvePromises: Promise<{ providerName: string; url: string; lang: string }>[] = [];

    for (const pp of providerPromises) {
      // When provider resolves, schedule URL resolution
      pp.then(({ name, items }) => {
        for (const item of items) {
          const rawUrl = item.url;
          if (!rawUrl) return;
          const lang = (item.lang === "spanish" ? "Castellano" : item.lang === "subbed" ? "Sub" : item.lang || "Latino");
          const resolveP = Promise.race([
            resolveDeep(rawUrl, RESOLVE_TIMEOUT).catch(() => [rawUrl]),
            new Promise<string[]>(r => setTimeout(() => r([rawUrl]), RESOLVE_TIMEOUT + 500)),
          ]).then(urls => urls.map(u => ({ providerName: name, url: u, lang })));
          allResolvePromises.push(...[resolveP].map(p => p.then(arr => arr[0]).catch(() => ({ providerName: name, url: rawUrl, lang }))));
        }
      });
    }

    // Wait for all providers to finish (which also lets all resolve promises be scheduled)
    await Promise.allSettled(providerPromises);

    // Wait for all resolve promises (they were scheduled while providers ran)
    const resolvedItems = await Promise.allSettled(allResolvePromises);

    // ── 5. Deduplicate and sort ───────────────────────────────────────────────
    const seen = new Set<string>();
    let count = 1;
    const finalSources: any[] = [];

    for (const r of resolvedItems) {
      if (r.status !== "fulfilled" || !r.value) continue;
      const { providerName, url: u, lang } = r.value;
      if (!u || seen.has(u)) continue;
      if (/minochinos|earnvids|short\.icu/i.test(u)) continue;
      if (/youtube\.com|youtu\.be/i.test(u)) continue;
      seen.add(u);

      finalSources.push({
        url: u,
        name: `${providerName} ${count++}`,
        lang,
        playbackType: getPlaybackType(u),
      });
    }

    // Prioritize direct streams
    const rank: Record<PlaybackType, number> = { hls: 0, mp4: 1, iframe: 2 };
    finalSources.sort((a, b) => rank[a.playbackType as PlaybackType] - rank[b.playbackType as PlaybackType]);

    // ── 6. Wrap HLS/MP4 with proxy ────────────────────────────────────────────
    const baseUrl = new URL(req.url);
    const proxyBase = `${baseUrl.origin}/api/v1/proxy`;

    const proxiedSources = finalSources.map(s => {
      if (s.playbackType === "hls" || s.playbackType === "mp4") {
        const params = new URLSearchParams({ url: s.url });
        return { ...s, url: `${proxyBase}?${params}`, originalUrl: s.url };
      }
      return s;
    });

    // Cache for next request
    if (proxiedSources.length > 0) setCached(cacheKey, proxiedSources);

    console.log(`[EmbedServe] ${metadata.title} — ${proxiedSources.length} sources in ${Date.now() - start}ms`);

    return NextResponse.json({
      success: true,
      _v: 8,
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
