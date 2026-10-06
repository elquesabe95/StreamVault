import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

import { getMovieDetails, getTvDetails, tmdbImage } from "@/lib/tmdb";
import { searchPelispedia, getPelispediaSources, getPelispediaEpisodeUrl } from "@/lib/scrapers/pelispedia";
import { searchCuevana, getCuevanaSources, getCuevanaEpisodeUrl } from "@/lib/scrapers/cuevana";
import { searchCinecalidad, getCinecalidadSources, getCinecalidadEpisodeUrl } from "@/lib/scrapers/cinecalidad";
import { searchGnula, getGnulaSources, getGnulaEpisodeUrl } from "@/lib/scrapers/gnula";
import { searchYandi, getYandiSources, getYandiEpisodeUrl } from "@/lib/scrapers/yandispoiler";
import { searchAnimeAV1, getAnimeAV1Episodes, getAnimeAV1Servers } from "@/lib/scrapers/animeav1";
import { searchJKAnime, getJKAnimeServers } from "@/lib/scrapers/jkanime";
import { searchAnimeFLV, getAnimeFLVServers } from "@/lib/scrapers/animeflv";
import { resolveStream } from "@/lib/scrapers/resolver";
import { publicOrigin } from "@/lib/public-origin";
import { getReferer } from "@/lib/cdn-referer";

type PlaybackType = "hls" | "mp4" | "iframe";

function getPlaybackType(url: string): PlaybackType {
  if (/\.m3u8(?:[?#].*)?$/i.test(url) || url.includes(".m3u8")) return "hls";
  if (/\.mp4(?:[?#].*)?$/i.test(url) || url.includes(".mp4")) return "mp4";
  return "iframe";
}

// ── In-memory cache — version-stamped so deploys start fresh ──────────────────
const CACHE_VERSION = "v10";
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
      // hglink.to is iframe-only; voe.sx can resolve to HLS
      if (/hglink\.to/i.test(u)) return [u];
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
        isAnime: show.genres?.some((g: any) => g.id === 16) && show.origin_country?.includes("JP"),
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

    const isAnime = type !== "movie" && !!metadata.isAnime;

    const providers: { name: string; fn: () => Promise<RawItem[]> }[] = isAnime
      ? [
          // ── Anime providers ───────────────────────────────────────────────────
          {
            name: "AnimeAV1",
            fn: async () => {
              const res = await searchAnimeAV1(query);
              const match = res[0] || null;
              if (!match) return [];
              const episodes = await getAnimeAV1Episodes(match.url);
              const ep = episodes.find(e => e.number === episode) || episodes[episode - 1] || episodes[0];
              if (!ep) return [];
              const servers = await getAnimeAV1Servers(ep.url);
              return servers.map(s => ({ url: s.url, lang: s.lang }));
            },
          },
          {
            name: "JKAnime",
            fn: async () => {
              const res = await searchJKAnime(query);
              if (!res?.length) return [];
              const match = res.find(r => r.slug) || res[0];
              const servers = await getJKAnimeServers(match.slug, episode);
              return servers.map((s: any) => ({ url: s.url || s.remote, lang: "Sub" }));
            },
          },
          {
            name: "AnimeFLV",
            fn: async () => {
              const res = await searchAnimeFLV(query);
              if (!res?.length) return [];
              const servers = await getAnimeFLVServers(res[0].url, episode);
              return servers.map((s: any) => ({ url: s.url || s.remote, lang: "Sub" }));
            },
          },
          {
            name: "PelisPedia",
            fn: async () => {
              const res = await searchPelispedia(query);
              const match = findMatch(res);
              if (!match) return [];
              const ep = await getPelispediaEpisodeUrl(match.url, season, episode);
              if (!ep) return [];
              const s = await getPelispediaSources(ep);
              return s.map((x: any) => ({ ...x, lang: "Latino" }));
            },
          },
        ]
      : [
          // ── Spanish movie/TV providers ────────────────────────────────────────
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

    // Reliability order measured from Render (/api/v1/debug?action=net):
    // pelispedia, cinecalidad and yandispoiler all answer; cuevana's DNS fails
    // and gnula 502s after ~14s. With bounded concurrency the order decides who
    // gets the CPU first, so the dead ones go last instead of starving the rest.
    if (!isAnime) {
      const PRIORITY = ["PelisPedia", "CineCalidad", "YandiSpoiler", "Cuevana", "Gnula"];
      const rank = (n: string) => {
        const i = PRIORITY.indexOf(n);
        return i < 0 ? PRIORITY.length : i;
      };
      providers.sort((a, b) => rank(a.name) - rank(b.name));
    }

    // ── 4. Run providers, best first, a couple at a time ─────────────────────
    // Timeout wraps the ENTIRE scrape+resolve for each provider.
    // No per-step timeouts inside — that's what was killing the resolver before.
    //
    // Budget sizing: the old 18s was cut to fit Vercel's 25s function cap. Render
    // runs a long-lived Node server with no such cap, but its free plan gives
    // 0.1 CPU, so under 18s no provider ever finished and the response came back
    // with sources: [] — a player stuck on "Buscando fuentes".
    const PROVIDER_BUDGET = Number(process.env.PROVIDER_BUDGET_MS) || 55000;
    // Once a directly playable stream is in hand, stop starting new providers and
    // give whatever is still in flight a short grace period for alternatives.
    const EARLY_EXIT_GRACE = Number(process.env.EARLY_EXIT_GRACE_MS) || 6000;
    // Running all five at once is counterproductive on 0.1 CPU: they contend for
    // the same core parsing hundreds of KB of HTML, so the one that would have
    // succeeded on its own misses the budget. PelisPedia alone finds Interstellar
    // in 48s; five-way parallel found nothing in 55s.
    const CONCURRENCY = Math.max(1, Number(process.env.PROVIDER_CONCURRENCY) || 2);

    type Hit = { providerName: string; url: string; lang: string };

    const pTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([p, new Promise<T>(r => setTimeout(() => r(fallback), ms))]);

    const deadline = start + PROVIDER_BUDGET;
    const hits: Hit[] = [];
    let firstStreamAt = 0;
    let nextProvider = 0;

    const runProvider = async (p: { name: string; fn: () => Promise<RawItem[]> }) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return;
      const found = await pTimeout(
        (async () => {
          const items: RawItem[] = await p.fn().catch(() => []);
          const resolved = await Promise.all(
            items.map(async (item) => {
              if (!item.url) return [];
              const lang = item.lang === "spanish" ? "Castellano"
                : item.lang === "subbed" ? "Sub"
                : item.lang || "Latino";
              const urls = await resolveToPlayable(item.url);
              return urls.map(u => ({ providerName: p.name, url: u, lang }));
            })
          );
          return resolved.flat();
        })(),
        remaining,
        [] as Hit[]
      );
      hits.push(...found);
      if (!firstStreamAt && found.some(h => getPlaybackType(h.url) !== "iframe")) {
        firstStreamAt = Date.now();
        console.log(`[EmbedServe] first stream from ${p.name} at ${Date.now() - start}ms`);
      }
    };

    const worker = async () => {
      for (;;) {
        // Stop starting new providers once something playable is in hand, or the
        // budget is spent.
        if (firstStreamAt || Date.now() >= deadline) return;
        const idx = nextProvider++;
        if (idx >= providers.length) return;
        await runProvider(providers[idx]);
      }
    };

    await Promise.race([
      Promise.all(Array.from({ length: Math.min(CONCURRENCY, providers.length) }, worker)),
      (async () => {
        while (Date.now() < deadline) {
          if (firstStreamAt && Date.now() - firstStreamAt >= EARLY_EXIT_GRACE) return;
          await new Promise(r => setTimeout(r, 400));
        }
      })(),
    ]);

    // ── 5. Deduplicate and sort ───────────────────────────────────────────────
    const seen = new Set<string>();
    let count = 1;
    const finalSources: any[] = [];

    for (const { providerName, url: u, lang } of hits) {
      if (!u || seen.has(u)) continue;
      if (/minochinos|earnvids|short\.icu/i.test(u)) continue;
      if (/youtube\.com|youtu\.be/i.test(u)) continue;
      if (getPlaybackType(u) === "iframe" && /tveo\.site/i.test(u)) continue;
      seen.add(u);
      finalSources.push({ url: u, name: `${providerName} ${count++}`, lang, playbackType: getPlaybackType(u) });
    }

    // ── 5b. Check which streams this server can actually redeem ─────────────
    // The CDN tokens in these URLs are bound to the IP that fetched the embed
    // page. Where the scrape has to go out through a rotating proxy — as it does
    // on Render, which PelisPedia blocks directly — that address never matches
    // the one this server fetches from, so every HLS source 403s. The player
    // only discovers that one source at a time, spending ~40s cycling through
    // dead entries before it reaches an iframe that works. The probe runs the
    // exact request the proxy would, so a pass here means the player can load
    // it. Dead streams are ranked below the iframes rather than dropped, so
    // they stay available if the probe is wrong.
    const PROBE_TIMEOUT = Number(process.env.STREAM_PROBE_MS) || 6000;

    const probe = async (rawUrl: string): Promise<boolean> => {
      const ref = getReferer(rawUrl);
      try {
        const res = await fetch(rawUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "*/*",
            ...(ref ? { Referer: ref, Origin: new URL(ref).origin } : {}),
          },
          signal: AbortSignal.timeout(PROBE_TIMEOUT),
        });
        return res.ok;
      } catch {
        return false;
      }
    };

    const alive = await Promise.all(
      finalSources.map(s => s.playbackType === "iframe" ? Promise.resolve(true) : probe(s.url))
    );
    finalSources.forEach((s, i) => { s.redeemable = alive[i]; });
    const deadStreams = alive.filter(ok => !ok).length;

    const rank: Record<PlaybackType, number> = { hls: 0, mp4: 1, iframe: 2 };
    finalSources.sort((a, b) => {
      // Anything this server cannot fetch goes last, whatever its type.
      if (a.redeemable !== b.redeemable) return a.redeemable ? -1 : 1;
      return rank[a.playbackType as PlaybackType] - rank[b.playbackType as PlaybackType];
    });

    // ── 6. Proxy HLS/MP4 through our Node.js server (same AWS IP as scraper) ─
    const origin = publicOrigin(req);
    const proxyBase = `${origin}/api/v1/proxy`;

    const proxiedSources = finalSources.map(s => {
      if (s.playbackType === "hls" || s.playbackType === "mp4") {
        return { ...s, url: `${proxyBase}?${new URLSearchParams({ url: s.url })}`, originalUrl: s.url };
      }
      return s;
    });

    // Only cache if something is actually playable.
    const hasStream = proxiedSources.some(s => s.redeemable);
    if (hasStream) setCached(cacheKey, proxiedSources);

    console.log(`[EmbedServe] ${metadata.title} — ${proxiedSources.length} sources (${proxiedSources.filter(s=>s.playbackType==="hls").length} HLS, ${deadStreams} unredeemable) in ${Date.now() - start}ms`);

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
