import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getAnimuxChannels } from "@/lib/scrapers/animux";
import * as iptv from "@/lib/scrapers/iptv-org";
import { getChannelsByCountry, searchChannels as searchTele } from "@/lib/teleonline";
import { channels as staticChannels } from "@/lib/scrapers/channels";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20; 
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";
  
  try {
    const whereClause: any = {};
    if (search) {
      whereClause.name = { contains: search };
    }

    const [dbChannels, totalCount] = await Promise.all([
      prisma.channel.findMany({
        where: whereClause,
        orderBy: { name: "asc" },
        skip: skip,
        take: limit,
      }),
      prisma.channel.count({ where: whereClause })
    ]);

    let results = dbChannels.map(ch => ({
      name: ch.name,
      url: ch.url,
      logo: ch.logo || "",
      category: ch.category || "General",
      country: ch.country || "Intl",
      provider: ch.provider,
      headers: ch.headers ? JSON.parse(ch.headers) : undefined
    }));

    if (search && page === 1) {
      const [liveTele, allAnimux] = await Promise.allSettled([
        searchTele(search),
        getAnimuxChannels()
      ]);

      const liveResults: any[] = [];
      if (liveTele.status === "fulfilled") {
        liveResults.push(...liveTele.value.map(ch => ({
          name: ch.name,
          url: `/api/v1/scraper?slug=${ch.slug}&provider=teleonline`,
          logo: ch.logo || "",
          category: "TeleOnline",
          provider: "TeleOnline"
        })));
      }

      if (allAnimux.status === "fulfilled") {
        const filteredAnimux = allAnimux.value
          .filter(ch => ch.name.toLowerCase().includes(search.toLowerCase()))
          .map(ch => ({
            name: ch.name,
            url: `/api/v1/scraper?slug=${encodeURIComponent(ch.url)}&provider=animux`,
            logo: ch.logo || "",
            category: ch.category || "Animux",
            provider: "Animux"
          }));
        liveResults.push(...filteredAnimux);
      }

      const combined = [...liveResults, ...results];
      const seen = new Set();
      results = combined.filter(ch => {
        const key = `${ch.name.toLowerCase()}-${ch.provider}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (page === 1 && !search && results.length === 0) {
      results = staticChannels.map(c => ({ ...c, provider: "Premium" }));
      
      // Attempt to get international channels from IPTV-org directly if DB is empty
      try {
        const res = await fetch("https://iptv-org.github.io/api/streams/co.json");
        const streams = await res.json();
        if (Array.isArray(streams)) {
          const sample = streams.slice(0, 50).map(s => ({
            name: s.channel || "Canal Internacional",
            url: s.url,
            logo: "",
            category: "Internacional",
            provider: "IPTV-org"
          }));
          results.push(...sample);
        }
      } catch (e) {}

      if (iptv && (iptv as any).syncChannelsGlobal) {
        (iptv as any).syncChannelsGlobal().catch((e: any) => console.error("Sync error:", e));
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      total: search ? results.length : totalCount,
      page,
      totalPages: Math.ceil((search ? results.length : totalCount) / limit),
      results
    });

  } catch (error) {
    console.error("[API/TV/ALL] Error:", error);
    // Fallback to static channels on any error (like database connection issues)
    return NextResponse.json({ 
      success: true, 
      count: staticChannels.length,
      results: staticChannels.map(c => ({ ...c, provider: "Premium" })) 
    });
  }
}
