import { NextRequest, NextResponse } from "next/server";
import { getTvDetails, getTvSeasonDetails, tmdbImage } from "@/lib/tmdb";
import { getAllEmbeds } from "@/lib/embed-sources";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tvId = parseInt(id);

    if (isNaN(tvId)) {
      return NextResponse.json(
        { success: false, message: "ID de serie/anime invalido" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const seasonParam = searchParams.get("season");

    const show = await getTvDetails(tvId);

    const trailer = show.videos?.results?.find(
      (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
    );

    const seasons = show.seasons.filter((s) => s.season_number > 0).map((s) => ({
      id: s.id,
      season_number: s.season_number,
      name: s.name,
      episode_count: s.episode_count,
      air_date: s.air_date,
      poster: tmdbImage(s.poster_path),
    }));

    // Get episodes for the requested season or first season
    const targetSeason = seasonParam ? parseInt(seasonParam) : (show.seasons.find(s => s.season_number > 0)?.season_number || 1);
    let episodes: { id: number; episode_number: number; name: string; overview: string; air_date: string | null; still: string; rating: number; runtime: number }[] = [];

    try {
      const seasonData = await getTvSeasonDetails(tvId, targetSeason);
      episodes = seasonData.episodes.map((ep) => ({
        id: ep.id,
        episode_number: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        air_date: ep.air_date,
        still: tmdbImage(ep.still_path, "w400"),
        rating: ep.vote_average,
        runtime: ep.runtime,
      }));
    } catch {
      // season details may not be available
    }

    // Generate embeds for the first episode of the target season
    const embeds = getAllEmbeds("tv", tvId, targetSeason, 1);

    return NextResponse.json({
      success: true,
      data: {
        id: show.id,
        title: show.name,
        original_title: show.original_name,
        overview: show.overview,
        tagline: show.tagline,
        poster: tmdbImage(show.poster_path),
        backdrop: tmdbImage(show.backdrop_path, "w1280"),
        first_air_date: show.first_air_date,
        last_air_date: show.last_air_date,
        number_of_seasons: show.number_of_seasons,
        number_of_episodes: show.number_of_episodes,
        rating: show.vote_average,
        votes: show.vote_count,
        status: show.status,
        homepage: show.homepage,
        popularity: show.popularity,
        origin_country: show.origin_country,
        created_by: show.created_by.map((c) => ({
          id: c.id,
          name: c.name,
          photo: tmdbImage(c.profile_path, "w185"),
        })),
        genres: show.genres.map((g) => ({ id: g.id, name: g.name })),
        seasons,
        current_season: targetSeason,
        episodes,
        trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
        trailer_key: trailer?.key || null,
        embeds,
        similar: show.similar?.results?.slice(0, 8).map((s) => ({
          id: s.id,
          title: s.title || s.name,
          poster: tmdbImage(s.poster_path),
          rating: s.vote_average,
          media_type: "tv" as const,
        })) || [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
