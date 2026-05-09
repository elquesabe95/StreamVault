import { readJson } from "./client";
import { prisma } from "../prisma";
import { getAnimuxChannels } from "./animux";
import { getChannelsByCountry, searchChannels } from "../teleonline";

const API_BASE = "https://iptv-org.github.io/api";

async function syncChannelsGlobal() {
  console.log("[Sync] Starting global deep synchronization...");
  
  try {
    // 1. Premium Search Terms (RCN, Caracol, etc.)
    const searchTerms = ["rcn", "caracol", "espn", "fox sports", "win sports", "hbo", "tnt", "discovery", "disney", "star plus"];
    for (const term of searchTerms) {
      console.log(`[Sync] Deep searching for: ${term}...`);
      const results = await searchChannels(term);
      for (const ch of results) {
        await prisma.channel.upsert({
          where: { id: `tele-search-${ch.slug}` },
          update: {
            name: ch.name,
            url: `/api/v1/scraper?slug=${ch.slug}&provider=teleonline`,
            logo: ch.logo || null,
            category: "PREMIUM",
            provider: "TeleOnline",
          },
          create: {
            id: `tele-search-${ch.slug}`,
            name: ch.name,
            url: `/api/v1/scraper?slug=${ch.slug}&provider=teleonline`,
            logo: ch.logo || null,
            category: "PREMIUM",
            provider: "TeleOnline",
          }
        });
      }
    }

    // 2. Sync Animux (Premium channels)
    const animuxChannels = await getAnimuxChannels();
    for (const ch of animuxChannels) {
      await prisma.channel.upsert({
        where: { id: `animux-${ch.id}` },
        update: {
          name: ch.name,
          url: `/api/v1/scraper?slug=${encodeURIComponent(ch.url)}&provider=animux`,
          logo: ch.logo || null,
          category: ch.category || "Animux",
          provider: "Animux",
        },
        create: {
          id: `animux-${ch.id}`,
          name: ch.name,
          url: `/api/v1/scraper?slug=${encodeURIComponent(ch.url)}&provider=animux`,
          logo: ch.logo || null,
          category: ch.category || "Animux",
          provider: "Animux",
        }
      });
    }

    // 3. Sync Main Countries
    const countries = ["colombia", "mexico", "espana", "argentina"];
    for (const country of countries) {
      const teleChannels = await getChannelsByCountry(country);
      for (const ch of teleChannels) {
        await prisma.channel.upsert({
          where: { id: `tele-${ch.slug}` },
          update: {
            name: ch.name,
            url: `/api/v1/scraper?slug=${ch.slug}&provider=teleonline`,
            logo: ch.logo || null,
            category: country.toUpperCase(),
            provider: "TeleOnline",
          },
          create: {
            id: `tele-${ch.slug}`,
            name: ch.name,
            url: `/api/v1/scraper?slug=${ch.slug}&provider=teleonline`,
            logo: ch.logo || null,
            category: country.toUpperCase(),
            provider: "TeleOnline",
          }
        });
      }
    }

    // 4. Sync IPTV-org (International fallback)
    const [channels, streams, logos] = await Promise.all([
      readJson<any[]>(`${API_BASE}/channels.json`),
      readJson<any[]>(`${API_BASE}/streams.json`),
      readJson<any[]>(`${API_BASE}/logos.json`),
    ]);

    if (Array.isArray(channels) && Array.isArray(streams)) {
      const logoMap = new Map(logos.map(l => [l.channel, l.url]));
      const channelMap = new Map(channels.map(c => [c.id, c]));
      const targetCountries = ["AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "SV", "GT", "HN", "MX", "NI", "PA", "PY", "PE", "PR", "ES", "UY", "VE"];
      
      const filteredStreams = streams.filter(s => {
        if (!s.channel) return false;
        const ch = channelMap.get(s.channel);
        return ch && (targetCountries.includes(ch.country) || ch.categories?.includes("sports"));
      });

      for (const s of filteredStreams) {
        const ch = channelMap.get(s.channel!)!;
        await prisma.channel.upsert({
          where: { id: s.channel! },
          update: {
            name: ch.name || s.title,
            url: s.url,
            logo: logoMap.get(s.channel!) || null,
            category: ch.categories?.[0] || "General",
            country: ch.country || null,
            headers: JSON.stringify({ "User-Agent": s.user_agent, "Referer": s.referrer }),
          },
          create: {
            id: s.channel!,
            name: ch.name || s.title,
            url: s.url,
            logo: logoMap.get(s.channel!) || null,
            category: ch.categories?.[0] || "General",
            country: ch.country || null,
            provider: "IPTV-org",
            headers: JSON.stringify({ "User-Agent": s.user_agent, "Referer": s.referrer }),
          }
        });
      }
    }

    console.log("[Sync] Global sync completed.");
  } catch (e) {
    console.error("[Sync] Global sync failed:", e);
  }
}

async function getIptvOrgChannels(): Promise<any[]> {
  const count = await prisma.channel.count();
  if (count === 0) syncChannelsGlobal();
  return await prisma.channel.findMany({ orderBy: { name: "asc" } });
}

export { syncChannelsGlobal, getIptvOrgChannels };
