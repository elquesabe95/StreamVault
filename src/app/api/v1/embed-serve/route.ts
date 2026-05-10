import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getMovieDetails, getTvDetails, tmdbImage } from "@/lib/tmdb";
import { searchPelispedia, getPelispediaSources, getPelispediaEpisodeUrl } from "@/lib/scrapers/pelispedia";
import { resolveStream } from "@/lib/scrapers/resolver";

type PlaybackType = "hls" | "mp4" | "iframe";
function getPlaybackType(url: string): PlaybackType {
  if (/\.m3u8(?:[?#].*)?$/i.test(url) || url.includes(".m3u8")) return "hls";
  if (/\.mp4(?:[?#].*)?$/i.test(url) || url.includes(".mp4")) return "mp4";
  return "iframe";
}

async function resolveDeep(url: string): Promise<string[]> {
  const first = await resolveStream(url).catch(() => url);
  const urls = Array.isArray(first) ? first : [first];
  return urls.filter(u => u !== url || urls.length === 1).slice(0, 10);
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
      return results.find((r: any) => norm(r.title) === q) ||
        results.find((r: any) => { const t = norm(r.title); return t.includes(q) || q.includes(t); }) ||
        results[0];
    };

    const providers = [
      {
        name: "PelisPedia",
        fn: async () => {
          const res = await searchPelispedia(query);
          const match = findExactMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          if (type !== "movie" && match.url.includes("/serie/")) {
            const epUrl = await getPelispediaEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl; else return [];
          }
          const sources = await getPelispediaSources(targetUrl);
          return sources.map((s: any) => ({ ...s, lang: "Latino" }));
        },
      },
    ];

    const finalSources: any[] = [];
    const seen = new Set<string>();
    let count = 1;

    for (const provider of providers) {
      try {
        const results = await provider.fn();
        for (const item of results) {
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
              name: `Servidor ${count++}`,
              lang,
              playbackType: getPlaybackType(u),
            });
          }
        }
      } catch (e) {
        console.warn(`[EmbedServe] ${provider.name}: ${(e as Error).message}`);
      }
    }

    console.log(`[EmbedServe] ${metadata.title} — ${finalSources.length} sources in ${Date.now() - start}ms`);

    return NextResponse.json({
      success: true,
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
