import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { searchJKAnime, getJKAnimeServers } from "@/lib/scrapers/jkanime";
import { searchAnimeFLV, getAnimeFLVServers } from "@/lib/scrapers/animeflv";
import { searchAnimeAV1, getAnimeAV1Episodes, getAnimeAV1Servers } from "@/lib/scrapers/animeav1";
import { searchAnime1v, getAnime1vEpisodes, getAnime1vEpisodeLinks } from "@/lib/scrapers/anime1v";
import { searchCuevana, getCuevanaEpisodeUrl, getCuevanaSources } from "@/lib/scrapers/cuevana";
import { searchPelispedia, getPelispediaEpisodeUrl, getPelispediaSources } from "@/lib/scrapers/pelispedia";
import { searchCinecalidad, getCinecalidadEpisodeUrl, getCinecalidadSources } from "@/lib/scrapers/cinecalidad";
import { searchDoramasflix, getDoramasflixEpisodes, getDoramasflixServers } from "@/lib/scrapers/doramasflix";
import { getTeleOnlineStream } from "@/lib/scrapers/teleonline";
import { getAnimuxStream } from "@/lib/scrapers/animux";
import { resolveStream } from "@/lib/scrapers/resolver";

type PlaybackType = "hls" | "mp4" | "iframe";

function getPlaybackType(url: string): PlaybackType {
  if (/\.m3u8(?:[?#].*)?$/i.test(url) || url.includes(".m3u8")) return "hls";
  if (/\.mp4(?:[?#].*)?$/i.test(url) || url.includes(".mp4")) return "mp4";
  return "iframe";
}

async function resolveToPlayableUrls(url: string): Promise<string[]> {
  const firstPass = await resolveStream(url).catch(() => url);
  const firstUrls = Array.isArray(firstPass) ? firstPass : [firstPass];
  const playableUrls: string[] = [];

  for (const firstUrl of firstUrls) {
    if (getPlaybackType(firstUrl) !== "iframe") {
      playableUrls.push(firstUrl);
      continue;
    }

    const secondPass = await resolveStream(firstUrl).catch(() => firstUrl);
    const secondUrls = Array.isArray(secondPass) ? secondPass : [secondPass];
    playableUrls.push(...secondUrls);
  }

  return playableUrls;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query");
    const provider = searchParams.get("provider")?.toLowerCase();
    const slug = searchParams.get("slug");
    const requestedType = searchParams.get("type");
    const type = requestedType === "tv" ? "series" : requestedType;
    const requestedSource = searchParams.get("source")?.toLowerCase();
    const season = parseInt(searchParams.get("season") || "1");
    const episode = parseInt(searchParams.get("episode") || "1");

    if (provider === "teleonline") {
      if (!slug) return NextResponse.json({ success: false, message: "Slug required" }, { status: 400 });

      const streamUrl = await getTeleOnlineStream(slug);
      return NextResponse.json({
        success: true,
        sources: streamUrl ? [{
          url: streamUrl,
          name: "Servidor 1",
          lang: "Live",
          playbackType: getPlaybackType(streamUrl),
        }] : [],
      });
    }

    if (provider === "animux") {
      if (!slug) return NextResponse.json({ success: false, message: "Slug required" }, { status: 400 });

      const streamUrl = await getAnimuxStream(slug);
      return NextResponse.json({
        success: true,
        sources: streamUrl ? [{
          url: streamUrl,
          name: "Servidor 1",
          lang: "Live",
          playbackType: getPlaybackType(streamUrl),
        }] : [],
      });
    }

    if (!query) return NextResponse.json({ success: false, message: "Query required" }, { status: 400 });

    const findExactMatch = (results: any[]) => {
      if (!results || results.length === 0) return null;
      const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const normalizeTitle = (title: string) =>
        title
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();
      const exact = results.find(r => normalizeTitle(r.title) === q);
      if (exact) return exact;
      return results.find(r => {
        const t = normalizeTitle(r.title);
        return t.includes(q) || q.includes(t);
      }) || results[0];
    };

    let providers: { name: string; key: string; fn: () => Promise<any[]> }[] = [];

    if (type === "anime") {
      providers.push(
        { name: "AnimeAV1", key: "animeav1", fn: async () => {
          const res = await searchAnimeAV1(query);
          const match = findExactMatch(res);
          if (!match) return [];
          const episodes = await getAnimeAV1Episodes(match.url);
          const ep = episodes.find(e => e.number === episode) || episodes[episode - 1] || episodes[0];
          if (!ep) return [];
          return await getAnimeAV1Servers(ep.url);
        }},
        { name: "Anime1v", key: "anime1v", fn: async () => {
          const res = await searchAnime1v(query);
          const match = findExactMatch(res);
          if (!match) return [];
          const episodes = await getAnime1vEpisodes(match.url);
          const ep = episodes.find((e: any) =>
            Number(e.number) === episode ||
            e.name?.includes(String(episode)) ||
            e.title?.includes(String(episode))
          ) || episodes[episode - 1] || episodes[0];
          if (!ep) return [];

          const data = await getAnime1vEpisodeLinks(ep.url);
          const dubStreams = data.streamLinks?.DUB || [];
          const subStreams = data.streamLinks?.SUB || [];
          const dubDownloads = data.downloadLinks?.DUB || [];
          const subDownloads = data.downloadLinks?.SUB || data.downloads || [];

          return [
            ...dubStreams.map(s => ({ url: s.url, server: s.server || "Anime1v", lang: "Latino" })),
            ...dubDownloads.map(s => ({ url: s.url, server: s.server || "Anime1v", lang: "Latino" })),
            ...subStreams.map(s => ({ url: s.url, server: s.server || "Anime1v", lang: "Sub" })),
            ...subDownloads.map(s => ({ url: s.url, server: s.server || "Anime1v", lang: "Sub" })),
          ];
        }},
        { name: "JKAnime", key: "jkanime", fn: async () => {
          const res = await searchJKAnime(query);
          const match = findExactMatch(res);
          return match ? await getJKAnimeServers(match.slug, episode) : [];
        }},
        { name: "AnimeFLV", key: "animeflv", fn: async () => {
          const res = await searchAnimeFLV(query);
          const match = findExactMatch(res);
          return match ? await getAnimeFLVServers(match.url, episode) : [];
        }},
        { name: "PelisPedia", key: "pelispedia", fn: async () => {
          const res = await searchPelispedia(query);
          const match = findExactMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          if (match.url.includes("/serie/")) {
            const epUrl = await getPelispediaEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl;
            else return [];
          }
          const sources = await getPelispediaSources(targetUrl);
          return sources.map(source => ({ ...source, lang: "Latino" }));
        }},

      );
    } else {
      providers.push(
        { name: "Cuevana", key: "cuevana", fn: async () => {
          const res = await searchCuevana(query);
          const match = findExactMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          if (type === "series") {
            const epUrl = await getCuevanaEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl;
            else return [];
          }
          return await getCuevanaSources(targetUrl);
        }},
        { name: "PelisPedia", key: "pelispedia", fn: async () => {
          const res = await searchPelispedia(query);
          const match = findExactMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          if (type === "series") {
            const epUrl = await getPelispediaEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl;
            else return [];
          }
          return await getPelispediaSources(targetUrl);
        }},
        { name: "CineCalidad", key: "cinecalidad", fn: async () => {
          const res = await searchCinecalidad(query);
          const match = findExactMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          if (type === "series") {
            const epUrl = await getCinecalidadEpisodeUrl(match.url, season, episode);
            if (epUrl) targetUrl = epUrl;
            else return [];
          }
          return await getCinecalidadSources(targetUrl);
        }},
        { name: "Doramasflix", key: "doramasflix", fn: async () => {
          const res = await searchDoramasflix(query);
          const match = findExactMatch(res);
          if (!match) return [];
          let targetUrl = match.url;
          if (type === "series") {
            const eps = await getDoramasflixEpisodes(match.slug);
            const ep = eps.find(e => e.number === episode);
            if (ep) targetUrl = ep.url;
            else return [];
          } else {
            targetUrl = `https://doramasflix.co${match.slug}`;
          }
          return await getDoramasflixServers(targetUrl);
        }}
      );
    }

    if (requestedSource) {
      providers = providers.filter(provider => provider.key === requestedSource);
    }

    const finalSources: any[] = [];
    const seenUrls = new Set<string>();
    let serverCount = 1;

    for (const provider of providers) {
      try {
        const results = await provider.fn();
        for (const item of results) {
          const rawUrl = item.url || item.remote;
          if (!rawUrl) continue;

          const urlsToAdd = await resolveToPlayableUrls(rawUrl);

          for (const fUrl of urlsToAdd) {
            if (seenUrls.has(fUrl)) continue;
            if (getPlaybackType(fUrl) === "iframe" && /tveo\.site/i.test(fUrl)) continue;
            seenUrls.add(fUrl);

            const rawLang = item.lang || (type === "anime" ? "Sub" : "Latino");
            const normalizedLang = String(rawLang).toLowerCase();
            const langLabel =
              normalizedLang === "latino" ? "Latino" :
              normalizedLang === "spanish" ? "Castellano" :
              normalizedLang === "subbed" ? "Sub" :
              String(rawLang);

            finalSources.push({
              url: fUrl,
              name: `Servidor ${serverCount++}`,
              lang: langLabel,
              playbackType: getPlaybackType(fUrl),
              originalUrl: rawUrl,
            });
          }
        }
        if (finalSources.length > 0 && !requestedSource) break;
      } catch (e) {
        console.warn(`[Scraper] ${provider.name} failed`, e);
      }
    }

    return NextResponse.json({
      success: true,
      sources: finalSources
    });

  } catch (error) {
    console.error("[Scraper] Fatal error", error);
    return NextResponse.json({ success: false, message: "Error" }, { status: 500 });
  }
}
