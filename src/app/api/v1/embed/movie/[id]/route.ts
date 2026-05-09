import { NextRequest, NextResponse } from "next/server";
import { getPrimaryEmbed, getAllEmbeds } from "@/lib/embed-sources";
import { getMovieDetails, tmdbImage } from "@/lib/tmdb";

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
    const primaryEmbed = getPrimaryEmbed("movie", movieId);
    const allEmbeds = getAllEmbeds("movie", movieId).map(source => {
      if (source.name === "pelispedia") {
        return {
          ...source,
          url: `/api/v1/scraper?source=pelispedia&query=${encodeURIComponent(movie.title)}&type=movie&tmdbId=${movieId}`,
        };
      }
      return source;
    });

    return NextResponse.json({
      success: true,
      data: {
        id: movie.id,
        title: movie.title,
        poster: tmdbImage(movie.poster_path),
        backdrop: tmdbImage(movie.backdrop_path, "w1280"),
        year: movie.release_date?.substring(0, 4) || "",
        rating: movie.vote_average,
        primary_embed: primaryEmbed,
        sources: allEmbeds,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
