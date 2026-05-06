import { NextRequest, NextResponse } from "next/server";
import { getTrending, tmdbImage } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") || "all") as "all" | "movie" | "tv";
    const window = (searchParams.get("window") || "week") as "day" | "week";

    const data = await getTrending(type, window);

    const formatted = data.results.map((item) => ({
      id: item.id,
      title: item.title || item.name,
      overview: item.overview,
      poster: tmdbImage(item.poster_path),
      backdrop: tmdbImage(item.backdrop_path, "w1280"),
      release_date: item.release_date || item.first_air_date || "",
      rating: item.vote_average,
      media_type: item.media_type === "tv" ? "tv" : "movie",
      popularity: item.popularity,
    }));

    return NextResponse.json({
      success: true,
      type,
      time_window: window,
      page: data.page,
      results: formatted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
