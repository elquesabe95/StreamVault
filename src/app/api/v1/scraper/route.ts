import { NextRequest, NextResponse } from "next/server";
import { searchPelispedia, getPelispediaSources } from "@/lib/scrapers/pelispedia";
import { searchJKAnime, getJKAnimeServers } from "@/lib/scrapers/jkanime";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source");
    const query = searchParams.get("query") || "";
    const type = searchParams.get("type") || "movie";
    const season = parseInt(searchParams.get("season") || "1");
    const episode = parseInt(searchParams.get("episode") || "1");

    if (!source || !query) {
      return NextResponse.json({ success: false, message: "Faltan parámetros" }, { status: 400 });
    }

    if (source === "pelispedia") {
      const results = await searchPelispedia(query);
      if (results.length === 0) {
        return NextResponse.json({ success: false, message: "No se encontraron resultados en Pelispedia" }, { status: 404 });
      }

      // Find best match (simple title match)
      const bestMatch = results[0]; // Assuming first result for now
      const sources = await getPelispediaSources(bestMatch.url);
      
      // Filter for Latino if possible
      const latinoSource = sources.find(s => s.lang === "latino") || sources[0];
      
      if (!latinoSource) {
        return NextResponse.json({ success: false, message: "No se encontraron fuentes de video" }, { status: 404 });
      }

      // Redirect to the embed URL
      return NextResponse.redirect(latinoSource.url);
    }

    if (source === "jkanime") {
      const results = await searchJKAnime(query);
      if (results.length === 0) {
        return NextResponse.json({ success: false, message: "No se encontró el anime en JKAnime" }, { status: 404 });
      }

      const bestMatch = results[0];
      const servers = await getJKAnimeServers(bestMatch.slug, episode);
      
      if (servers.length === 0) {
        return NextResponse.json({ success: false, message: "No hay servidores disponibles para este episodio" }, { status: 404 });
      }

      // Use the first server (usually Nozomi or Fembed)
      return NextResponse.redirect(servers[0].remote);
    }

    return NextResponse.json({ success: false, message: "Fuente no soportada" }, { status: 400 });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en el scraper";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
