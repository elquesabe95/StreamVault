import { NextRequest, NextResponse } from "next/server";
import { getTvDetails, getTvSeasonDetails, tmdbImage } from "@/lib/tmdb";
import { getAllEmbeds } from "@/lib/embed-sources";

// Player API: returns all data needed for the Netflix-style embed player
// Used by the /player page when embedded on tveo.site or any other site

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "movie";
    const id = parseInt(searchParams.get("id") || "0");
    const season = parseInt(searchParams.get("season") || "1");
    const episode = parseInt(searchParams.get("episode") || "1");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Se requiere: id" },
        { status: 400 }
      );
    }

    if (type === "tv") {
      // TV/Series/Anime player data
      const show = await getTvDetails(id);

      // Get current season episodes
      let episodes: Array<{
        id: number;
        episode_number: number;
        name: string;
        overview: string;
        still: string;
        rating: number;
        runtime: number;
      }> = [];

      try {
        const seasonData = await getTvSeasonDetails(id, season);
        episodes = seasonData.episodes.map((ep) => ({
          id: ep.id,
          episode_number: ep.episode_number,
          name: ep.name,
          overview: ep.overview,
          still: tmdbImage(ep.still_path, "w400"),
          rating: ep.vote_average,
          runtime: ep.runtime,
        }));
      } catch {
        // Season data not available
      }

      // Get embed sources for current episode
      const sources = getAllEmbeds("tv", id, season, episode);

      // Calculate next episode info
      const currentEp = episodes.find((e) => e.episode_number === episode);
      const nextEp = episodes.find((e) => e.episode_number === episode + 1);
      const isLastEpisode = !nextEp;
      const seasons = show.seasons.filter((s) => s.season_number > 0);

      // Check if there's a next season
      let hasNextSeason = false;
      let nextSeasonNum = 0;
      if (isLastEpisode) {
        const currentSeasonIdx = seasons.findIndex((s) => s.season_number === season);
        if (currentSeasonIdx >= 0 && currentSeasonIdx < seasons.length - 1) {
          hasNextSeason = true;
          nextSeasonNum = seasons[currentSeasonIdx + 1].season_number;
        }
      }

      // Get next season episode count (for auto-next)
      let nextSeasonEpisodes = 0;
      if (hasNextSeason) {
        const nextSeasonData = seasons.find((s) => s.season_number === nextSeasonNum);
        nextSeasonEpisodes = nextSeasonData?.episode_count || 0;
      }

      return NextResponse.json({
        success: true,
        data: {
          type: "tv",
          id: show.id,
          title: show.name,
          poster: tmdbImage(show.poster_path),
          backdrop: tmdbImage(show.backdrop_path, "w1280"),
          rating: show.vote_average,
          genres: show.genres.map((g) => g.name),
          season,
          episode,
          episodeTitle: currentEp?.name || `Episodio ${episode}`,
          episodeOverview: currentEp?.overview || "",
          episodeRuntime: currentEp?.runtime || 0,
          episodes,
          totalSeasons: show.number_of_seasons,
          seasons: seasons.map((s) => ({
            season_number: s.season_number,
            name: s.name,
            episode_count: s.episode_count,
          })),
          sources: sources.map(s => {
            if (s.name === "pelispedia") {
              return { ...s, url: `/api/v1/scraper?source=pelispedia&query=${encodeURIComponent(show.name)}&type=tv&season=${season}&episode=${episode}` };
            }
            if (s.name === "jkanime" && show.genres.some(g => g.name.toLowerCase().includes("anim"))) {
              return { ...s, url: `/api/v1/scraper?source=jkanime&query=${encodeURIComponent(show.name)}&episode=${episode}` };
            }
            return s;
          }),
          nextEpisode: nextEp
            ? {
                season,
                episode: nextEp.episode_number,
                title: nextEp.name,
              }
            : hasNextSeason
              ? {
                  season: nextSeasonNum,
                  episode: 1,
                  title: `Temporada ${nextSeasonNum}, Episodio 1`,
                }
              : null,
          isLastEpisode,
          hasNextSeason,
          showCompleted: isLastEpisode && !hasNextSeason,
          status: show.status,
        },
      });
    } else {
      // Movie player data
      const { getMovieDetails } = await import("@/lib/tmdb");
      const movie = await getMovieDetails(id);
      const sources = getAllEmbeds("movie", id);

      return NextResponse.json({
        success: true,
        data: {
          type: "movie",
          id: movie.id,
          title: movie.title,
          poster: tmdbImage(movie.poster_path),
          backdrop: tmdbImage(movie.backdrop_path, "w1280"),
          rating: movie.vote_average,
          genres: movie.genres.map((g) => g.name),
          year: movie.release_date?.substring(0, 4) || "",
          runtime: movie.runtime,
          sources: sources.map(s => {
            if (s.name === "pelispedia") {
              return { ...s, url: `/api/v1/scraper?source=pelispedia&query=${encodeURIComponent(movie.title)}&type=movie` };
            }
            return s;
          }),
          // Movies don't have episodes
          nextEpisode: null,
          isLastEpisode: true,
          hasNextSeason: false,
          showCompleted: false,
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
