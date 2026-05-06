import { NextRequest, NextResponse } from "next/server";
import { discoverMovies, discoverTv, getMovieGenres, getTvGenres, tmdbImage } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "movie";
    const genre = searchParams.get("genre") || "";
    const year = searchParams.get("year") || "";
    const sort = searchParams.get("sort") || "popularity.desc";
    const page = searchParams.get("page") || "1";

    const isMovie = type === "movie";
    const data = isMovie
      ? await discoverMovies({ genre, year, sortBy: sort, page: parseInt(page) })
      : await discoverTv({ genre, year, sortBy: sort, page: parseInt(page) });

    const genres = isMovie ? await getMovieGenres() : await getTvGenres();

    const formatted = data.results.map((item) => ({
      id: item.id,
      title: item.title || item.name,
      overview: item.overview,
      poster: tmdbImage(item.poster_path),
      backdrop: tmdbImage(item.backdrop_path, "w1280"),
      release_date: item.release_date || item.first_air_date || "",
      rating: item.vote_average,
      media_type: isMovie ? "movie" : "tv",
      popularity: item.popularity,
    }));

    return NextResponse.json({
      success: true,
      type,
      page: data.page,
      total_pages: data.total_pages,
      total_results: data.total_results,
      genres: genres.genres,
      results: formatted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
