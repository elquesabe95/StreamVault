import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getAnimuxChannels } from "@/lib/scrapers/animux";
import { getChannelsByCountry, searchChannels as searchTele } from "@/lib/teleonline";
import { channels as staticChannels } from "@/lib/scrapers/channels";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";

  try {
    let results: any[] = [];
    let totalCount = 0;

    // 1. Try database first (fast if populated)
    const whereClause: any = {};
    if (search) whereClause.name = { contains: search };

    try {
      const [dbChannels, dbCount] = await Promise.all([
        prisma.channel.findMany({ where: whereClause, orderBy: { name: "asc" }, skip: (page - 1) * limit, take: limit }),
        prisma.channel.count({ where: whereClause })
      ]);
      results = dbChannels.map(ch => ({
        name: ch.name, url: ch.url, logo: ch.logo || "",
        category: ch.category || "General", country: ch.country || "Intl", provider: ch.provider,
      }));
      totalCount = dbCount;
    } catch (e) {
      // DB not available — fall through to live sources
    }

    // 2. If DB is empty, use live scrapers + static fallback
    if (results.length === 0 && page === 1) {
      const liveResults: any[] = [];

      // Fetch from live sources in parallel
      if (!search) {
        // Without search, get channels by popular countries
        const countries = ["colombia", "mexico", "espana", "argentina", "estados-unidos"];
        const countryResults = await Promise.allSettled(
          countries.map(c => getChannelsByCountry(c).catch(() => []))
        );
        for (const r of countryResults) {
          if (r.status === "fulfilled" && Array.isArray(r.value)) {
            for (const ch of r.value) {
              liveResults.push({
                name: ch.name, url: `/api/v1/scraper?slug=${ch.slug}&provider=teleonline`,
                logo: ch.logo || "", category: "TV", country: ch.country || "Intl", provider: "TeleOnline",
              });
            }
          }
        }
      } else {
        // With search
        const teleResults = await searchTele(search).catch(() => []);
        for (const ch of teleResults) {
          liveResults.push({
            name: ch.name, url: `/api/v1/scraper?slug=${ch.slug}&provider=teleonline`,
            logo: ch.logo || "", category: "TeleOnline", provider: "TeleOnline",
          });
        }
      }

      // Add Animux channels
      try {
        const animuxChannels = await getAnimuxChannels();
        const filtered = search
          ? animuxChannels.filter((ch: any) => ch.name.toLowerCase().includes(search.toLowerCase()))
          : animuxChannels;
        for (const ch of filtered) {
          liveResults.push({
            name: ch.name, url: `/api/v1/scraper?slug=${encodeURIComponent(ch.url)}&provider=animux`,
            logo: ch.logo || "", category: ch.category || "Animux", provider: "Animux",
          });
        }
      } catch {}

      // Add static premium channels
      for (const ch of staticChannels) {
        liveResults.push({
          name: ch.name, url: ch.url, logo: ch.logo || "",
          category: ch.category || "Premium", country: ch.country || "Intl", provider: "Premium",
        });
      }

      // Try IPTV-org direct
      try {
        const res = await fetch("https://iptv-org.github.io/api/streams/co.json");
        const streams = await res.json();
        if (Array.isArray(streams)) {
          for (const s of streams.slice(0, 100)) {
            liveResults.push({
              name: s.channel || "Canal IPTV", url: s.url, logo: "",
              category: "IPTV", provider: "IPTV-org",
            });
          }
        }
      } catch {}

      // Deduplicate
      const seen = new Set<string>();
      results = liveResults.filter(ch => {
        const key = `${ch.name.toLowerCase()}-${ch.provider}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      totalCount = results.length;

      // Paginate
      const start = (page - 1) * limit;
      results = results.slice(start, start + limit);

      // Trigger background DB sync
      try {
        const { syncChannelsGlobal } = await import("@/lib/scrapers/iptv-org");
        syncChannelsGlobal().catch(() => {});
      } catch {}
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      results,
    });

  } catch (error) {
    return NextResponse.json({
      success: true,
      count: staticChannels.length,
      total: staticChannels.length,
      page: 1,
      totalPages: 1,
      results: staticChannels.map(c => ({ ...c, provider: "Premium" })),
    });
  }
}
