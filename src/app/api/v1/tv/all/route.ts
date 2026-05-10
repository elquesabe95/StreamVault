import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getAnimuxChannels } from "@/lib/scrapers/animux";
import { searchChannels as searchTele, getChannelsByCountry } from "@/lib/teleonline";
import { channels as staticChannels } from "@/lib/scrapers/channels";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";

  try {
    let results: any[] = [];

    if (search) {
      // SEARCH: query live APIs
      const [teleResults, animuxAll] = await Promise.allSettled([
        searchTele(search),
        getAnimuxChannels().catch(() => []),
      ]);

      const liveResults: any[] = [];

      if (teleResults.status === "fulfilled" && Array.isArray(teleResults.value)) {
        for (const ch of teleResults.value.slice(0, 30)) {
          liveResults.push({
            name: ch.name, url: `/api/v1/scraper?slug=${ch.slug}&provider=teleonline`,
            logo: ch.logo || "", category: "TV", country: ch.country || "Intl", provider: "TeleOnline",
          });
        }
      }

      if (animuxAll.status === "fulfilled" && Array.isArray(animuxAll.value)) {
        const filtered = animuxAll.value
          .filter((ch: any) => ch.name.toLowerCase().includes(search.toLowerCase()))
          .slice(0, 30);
        for (const ch of filtered) {
          liveResults.push({
            name: ch.name, url: `/api/v1/scraper?slug=${encodeURIComponent(ch.url)}&provider=animux`,
            logo: ch.logo || "", category: ch.category || "Animux", provider: "Animux",
          });
        }
      }

      // Deduplicate
      const seen = new Set<string>();
      results = liveResults.filter(ch => {
        const key = `${ch.name.toLowerCase()}-${ch.provider}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else {
      // NO SEARCH: return premium channels instantly (no external API calls)
      results = staticChannels.map(c => ({
        name: c.name, url: c.url, logo: c.logo || "",
        category: c.category || "General", country: c.country || "Intl", provider: "Premium",
      }));

      // On page 1, fetch live channels from TeleOnline and Animux (with 8s timeout each)
      if (page === 1) {
        const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> => {
          return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
        };

        const [animuxChannels, ...countryResults] = await Promise.allSettled([
          withTimeout(getAnimuxChannels().catch(() => []), 15000),
          withTimeout(getChannelsByCountry("colombia").catch(() => []), 15000),
          withTimeout(getChannelsByCountry("mexico").catch(() => []), 15000),
          withTimeout(getChannelsByCountry("argentina").catch(() => []), 15000),
        ]);

        if (animuxChannels.status === "fulfilled" && Array.isArray(animuxChannels.value)) {
          for (const ch of animuxChannels.value.slice(0, 200)) {
            results.push({
              name: ch.name, url: `/api/v1/scraper?slug=${encodeURIComponent(ch.url)}&provider=animux`,
              logo: ch.logo || "", category: ch.category || "Animux", provider: "Animux",
            });
          }
        }

        for (const r of countryResults) {
          if (r.status === "fulfilled" && Array.isArray(r.value)) {
            for (const ch of r.value.slice(0, 50)) {
              results.push({
                name: ch.name, url: `/api/v1/scraper?slug=${ch.slug}&provider=teleonline`,
                logo: ch.logo || "", category: "TV", country: ch.country || "Intl", provider: "TeleOnline",
              });
            }
          }
        }

        // Deduplicate
        const seen = new Set<string>();
        results = results.filter(ch => {
          const key = `${ch.name.toLowerCase()}-${ch.provider}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    }

    const total = results.length;
    const start = (page - 1) * limit;
    results = results.slice(start, start + limit);

    return NextResponse.json({
      success: true,
      count: results.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
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
