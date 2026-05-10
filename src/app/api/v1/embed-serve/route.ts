import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getMovieDetails, getTvDetails, tmdbImage } from "@/lib/tmdb";
import { getAllEmbeds } from "@/lib/embed-sources";

export async function GET(req: NextRequest) {
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
    if (type === "movie") {
      const movie = await getMovieDetails(id);
      metadata = {
        id: movie.id,
        title: movie.title,
        poster: tmdbImage(movie.poster_path),
        backdrop: tmdbImage(movie.backdrop_path, "w1280"),
        year: movie.release_date?.substring(0, 4) || "",
        rating: movie.vote_average,
        runtime: movie.runtime,
      };
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
    }

    // 2. Fast iframe sources (instant, no scraping)
    const embeds = getAllEmbeds(type as "movie" | "tv", id, season, episode);

    const sources = embeds.map((source, index) => ({
      url: source.url,
      name: source.label,
      lang: source.needsScraping ? "Latino" : "Auto",
      playbackType: "iframe" as const,
      needsScraping: source.needsScraping || false,
    }));

    return NextResponse.json({
      success: true,
      data: {
        type,
        ...metadata,
        sources,
      },
    });

  } catch (error) {
    console.error("[EmbedServe] Error", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
