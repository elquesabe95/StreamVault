import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getMovieDetails, getTvDetails, tmdbImage } from "@/lib/tmdb";
import { searchCuevana, getCuevanaSources, getCuevanaEpisodeUrl } from "@/lib/scrapers/cuevana";
import { searchPelispedia, getPelispediaSources, getPelispediaEpisodeUrl } from "@/lib/scrapers/pelispedia";
import { searchCinecalidad, getCinecalidadSources, getCinecalidadEpisodeUrl } from "@/lib/scrapers/cinecalidad";
import { searchDoramasflix, getDoramasflixEpisodes, getDoramasflixServers } from "@/lib/scrapers/doramasflix";
import { resolveStream } from "@/lib/scrapers/resolver";

type PlaybackType = "hls" | "mp4" | "iframe";

function getPlaybackType(url: string): PlaybackType {
  if (/\.m3u8(?:[?#].*)?$/i.test(url) || url.includes(".m3u8")) return "hls";
  if (/\.mp4(?:[?#].*)?$/i.test(url) || url.includes(".mp4")) return "mp4";
  return "iframe";
}

async function resolveToPlayableUrls(url: string): Promise<string[]> {
  const firstPass = await resolveStream(url).catch(() => url);
  const firstUrls = Array.isArray(firstPass) ? firstPass : [firstPass];
  const playableUrls: string[] = [];

  for (const firstUrl of firstUrls) {
    if (getPlaybackType(firstUrl) !== "iframe") {
      playableUrls.push(firstUrl);
      continue;
    }
    const secondPass = await resolveStream(firstUrl).catch(() => firstUrl);
    const secondUrls = Array.isArray(secondPass) ? secondPass : [secondPass];
    playableUrls.push(...secondUrls);
  }

  return playableUrls;
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

    // 1. TMDB metadata
    let metadata: any = {};
    let query = "";

    if (type === "movie") {
      const movie = await getMovieDetails(id);
      metadata = {
        id: movie.id,
        title: movie.title,
        poster: tmdbImage(movie.poster_path),
        backdrop: tmdbImage(movie.backdrop_path, "w1280"),
        year: movie.release_date?.substring(0, 4) || "",
        rating: movie.vote_average,
      };
      query = movie.title;
    } else {
      const show = await getTvDetails(id);
      metadata = {
        id: show.id,
        title: show.name,
        poster: tmdbImage(show.poster_path),
        backdrop: tmdbImage(show.backdrop_path, "w1280"),
        year: show.first_air_date?.substring(0, 4) || "",
        rating: show.vote_average,
        season,
        episode,
      };
      query = show.name;
    }

    // 2. Scrape sources
    const findExactMatch = (results: any[]) => {
      if (!results || results.length === 0) return null;
      const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const normalizeTitle = (title: string) =>
        title
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();
      const exact = results.find((r: any) => normalizeTitle(r.title) === q);
      if (exact) return exact;
      return results.find((r: any) => {
        const t = normalizeTitle(r.title);
        return t.includes(q) || q.includes(t);
      }) || results[0];
    };

    const providers = [
      {
        name: "Cuevana",
        fn: async () => {
          const res = await searchCuevana(query);
          const match = findExactMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          if (type !== "movie" && match.url.includes("/serie/")) {
            const epUrl = await getCuevanaEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl;
            else return [];
          }
          return await getCuevanaSources(targetUrl);
        },
      },
      {
        name: "PelisPedia",
        fn: async () => {
          const res = await searchPelispedia(query);
          const match = findExactMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          if (type !== "movie" && match.url.includes("/serie/")) {
            const epUrl = await getPelispediaEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl;
            else return [];
          }
          const sources = await getPelispediaSources(targetUrl);
          return sources.map((source: any) => ({ ...source, lang: "Latino" }));
        },
      },
      {
        name: "CineCalidad",
        fn: async () => {
          const res = await searchCinecalidad(query);
          const match = findExactMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          if (type !== "movie") {
            const epUrl = await getCinecalidadEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl;
            else return [];
          }
          return await getCinecalidadSources(targetUrl);
        },
      },
    ];

    // Doramasflix only for series/asian content
    if (type !== "movie") {
      providers.push({
        name: "Doramasflix",
        fn: async () => {
          const res = await searchDoramasflix(query);
          const match = findExactMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          const eps = await getDoramasflixEpisodes(match.slug);
          const ep = eps.find((e: any) => e.number === episode);
          if (ep) targetUrl = ep.url;
          else {
            targetUrl = `https://doramasflix.co${match.slug}`;
          }
          return await getDoramasflixServers(targetUrl);
        },
      });
    }

    const finalSources: any[] = [];
    const seenUrls = new Set<string>();
    let serverCount = 1;

    for (const provider of providers) {
      try {
        const results = await provider.fn();
        for (const item of results) {
          const rawUrl = item.url || item.remote;
          if (!rawUrl) continue;

          const urlsToAdd = await resolveToPlayableUrls(rawUrl);

          for (const fUrl of urlsToAdd) {
            if (seenUrls.has(fUrl)) continue;
            seenUrls.add(fUrl);

            const rawLang = item.lang || "Latino";
            const normalizedLang = String(rawLang).toLowerCase();
            const langLabel =
              normalizedLang === "latino" ? "Latino" :
              normalizedLang === "spanish" ? "Castellano" :
              normalizedLang === "subbed" ? "Sub" :
              String(rawLang);

            finalSources.push({
              url: fUrl,
              name: `Servidor ${serverCount++}`,
              lang: langLabel,
              playbackType: getPlaybackType(fUrl),
            });
          }
        }
        if (finalSources.length > 0) break;
      } catch (e) {
        console.warn(`[EmbedServe] ${provider.name} failed`, (e as Error).message);
      }
    }

    console.log(`[EmbedServe] ${metadata.title} — ${finalSources.length} sources in ${Date.now() - start}ms`);

    return NextResponse.json({
      success: true,
      data: {
        type,
        ...metadata,
        sources: finalSources,
      },
    });

  } catch (error) {
    console.error("[EmbedServe] Error", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error interno",
      },
      { status: 500 }
    );
  }
}
