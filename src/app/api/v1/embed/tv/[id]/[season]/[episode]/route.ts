import { NextRequest, NextResponse } from "next/server";
import { getPrimaryEmbed, getAllEmbeds } from "@/lib/embed-sources";
import { getTvDetails, tmdbImage } from "@/lib/tmdb";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; season: string; episode: string }> }
) {
  try {
    const { id, season, episode } = await params;
    const tvId = parseInt(id);
    const seasonNum = parseInt(season);
    const episodeNum = parseInt(episode);

    if (isNaN(tvId) || isNaN(seasonNum) || isNaN(episodeNum)) {
      return NextResponse.json(
        { success: false, message: "Parametros invalidos. Se requiere: id, season, episode" },
        { status: 400 }
      );
    }

    const show = await getTvDetails(tvId);
    const primaryEmbed = getPrimaryEmbed("tv", tvId, seasonNum, episodeNum);
    const allEmbeds = getAllEmbeds("tv", tvId, seasonNum, episodeNum).map(source => {
      const baseParams = `&query=${encodeURIComponent(show.name)}&episode=${episodeNum}&season=${seasonNum}&tmdbId=${tvId}`;
      if (source.name === "pelispedia") {
        return { ...source, url: `/api/v1/scraper?source=pelispedia&type=series${baseParams}` };
      }
      if (source.name === "jkanime") {
        return { ...source, url: `/api/v1/scraper?source=jkanime&type=anime${baseParams}` };
      }
      if (source.name === "anime1v") {
        return { ...source, url: `/api/v1/scraper?source=anime1v&type=anime${baseParams}` };
      }
      return source;
    });

    return NextResponse.json({
      success: true,
      data: {
        id: show.id,
        title: show.name,
        poster: tmdbImage(show.poster_path),
        backdrop: tmdbImage(show.backdrop_path, "w1280"),
        season: seasonNum,
        episode: episodeNum,
        year: show.first_air_date?.substring(0, 4) || "",
        rating: show.vote_average,
        primary_embed: primaryEmbed,
        sources: allEmbeds,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
