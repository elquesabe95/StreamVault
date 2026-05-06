import { NextRequest, NextResponse } from "next/server";
import { searchMulti, searchMovies, searchTv, tmdbImage, getDisplayTitle } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const type = searchParams.get("type") || "multi"; // multi | movie | tv
    const page = searchParams.get("page") || "1";

    if (!query.trim()) {
      return NextResponse.json(
        { success: false, message: "Parametro 'query' es requerido", example: "/api/v1/search?query=naruto&type=multi" },
        { status: 400 }
      );
    }

    let results;
    switch (type) {
      case "movie":
        results = await searchMovies(query, parseInt(page));
        break;
      case "tv":
        results = await searchTv(query, parseInt(page));
        break;
      default:
        results = await searchMulti(query, parseInt(page));
    }

    const formatted = results.results.map((item) => ({
      id: item.id,
      title: item.title || item.name,
      original_title: item.original_title || item.original_name,
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
      query,
      type,
      page: results.page,
      total_pages: results.total_pages,
      total_results: results.total_results,
      results: formatted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
