import { NextRequest, NextResponse } from "next/server";
import { getMovieDetails, tmdbImage } from "@/lib/tmdb";
import { getAllEmbeds } from "@/lib/embed-sources";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const movieId = parseInt(id);

    if (isNaN(movieId)) {
      return NextResponse.json(
        { success: false, message: "ID de pelicula invalido" },
        { status: 400 }
      );
    }

    const movie = await getMovieDetails(movieId);

    const trailer = movie.videos?.results?.find(
      (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
    );

    const embeds = getAllEmbeds("movie", movieId);

    return NextResponse.json({
      success: true,
      data: {
        id: movie.id,
        title: movie.title,
        original_title: movie.original_title,
        overview: movie.overview,
        tagline: movie.tagline,
        poster: tmdbImage(movie.poster_path),
        backdrop: tmdbImage(movie.backdrop_path, "w1280"),
        release_date: movie.release_date,
        runtime: movie.runtime,
        rating: movie.vote_average,
        votes: movie.vote_count,
        status: movie.status,
        adult: movie.adult,
        budget: movie.budget,
        revenue: movie.revenue,
        imdb_id: movie.imdb_id,
        homepage: movie.homepage,
        popularity: movie.popularity,
        genres: movie.genres.map((g) => ({ id: g.id, name: g.name })),
        production_companies: movie.production_companies.map((c) => ({
          id: c.id,
          name: c.name,
          logo: tmdbImage(c.logo_path, "w92"),
        })),
        trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
        trailer_key: trailer?.key || null,
        embeds,
        similar: movie.similar?.results?.slice(0, 8).map((s) => ({
          id: s.id,
          title: s.title || s.name,
          poster: tmdbImage(s.poster_path),
          rating: s.vote_average,
          media_type: "movie" as const,
        })) || [],
        collection: movie.belongs_to_collection ? {
          id: movie.belongs_to_collection.id,
          name: movie.belongs_to_collection.name,
          poster: tmdbImage(movie.belongs_to_collection.poster_path),
          backdrop: tmdbImage(movie.belongs_to_collection.backdrop_path, "w1280"),
        } : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
