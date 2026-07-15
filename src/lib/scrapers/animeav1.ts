import { readPage } from "./client";

const BASE_URL = "https://animeav1.com";

export interface AnimeAV1Result {
  title: string;
  slug: string;
  url: string;
  image?: string;
  type: string;
}

export interface AnimeAV1Episode {
  number: number;
  title: string;
  url: string;
}

export interface AnimeAV1Source {
  server: string;
  url: string;
  lang: "Latino" | "Sub";
  quality?: string;
}

// Deserialize SvelteKit's flat-data format.
// Object/array values are always indices into the flat array; primitives are literals.
function skResolve(flat: any[], idx: any, depth = 0): any {
  if (depth > 15) return undefined;
  if (typeof idx !== "number") return idx;
  const val = flat[idx];
  if (val === null || val === undefined) return val;
  if (typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map((i: any) => skResolve(flat, i, depth + 1));
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    result[k] = skResolve(flat, v as any, depth + 1);
  }
  return result;
}

// Fetch and deserialize a SvelteKit __data.json endpoint.
async function fetchSveltekitData(path: string, qs?: string): Promise<any | null> {
  const dataPath = path.replace(/\/+$/, "") + "/__data.json";
  const url = `${BASE_URL}${dataPath}${qs ? `?${qs}` : ""}`;
  const text = await readPage(url, { Accept: "application/json" });
  if (!text || text.trim().startsWith("<")) return null;
  try {
    const json = JSON.parse(text);
    const node = (json.nodes as any[])?.find(
      (n: any) => n?.type === "data" && Array.isArray(n.data) && n.data.length > 2
    );
    if (!node) return null;
    return skResolve(node.data, 0);
  } catch {
    return null;
  }
}

export async function searchAnimeAV1(query: string): Promise<AnimeAV1Result[]> {
  const root = await fetchSveltekitData("/catalogo", `search=${encodeURIComponent(query)}`);
  if (!root) return [];

  const results: any[] = Array.isArray(root.results) ? root.results : [];
  return results
    .filter((item: any) => item && (item.title || item.name) && item.slug)
    .map((item: any) => ({
      title: item.title || item.name,
      slug: item.slug,
      url: `${BASE_URL}/media/${item.slug}`,
      image: item.poster ? `https://cdn.animeav1.com${item.poster}` : undefined,
      type: "anime",
    }))
    .slice(0, 20);
}

export async function getAnimeAV1Episodes(url: string): Promise<AnimeAV1Episode[]> {
  const slug = url.replace(/^https?:\/\/[^/]+\/media\//, "").split("/")[0];
  const root = await fetchSveltekitData(`/media/${slug}`);
  if (!root) return [];

  const episodes: any[] = Array.isArray(root.media?.episodes) ? root.media.episodes : [];
  return episodes
    .filter((ep: any) => ep && ep.number > 0)
    .map((ep: any) => ({
      number: Number(ep.number),
      title: ep.title || `Episodio ${ep.number}`,
      url: `${BASE_URL}/media/${slug}/${ep.number}`,
    }))
    .sort((a, b) => a.number - b.number);
}

export async function getAnimeAV1Servers(url: string): Promise<AnimeAV1Source[]> {
  const parts = url.replace(/^https?:\/\/[^/]+\/media\//, "").split("/");
  const slug = parts[0];
  const epNum = parts[1];
  if (!slug || !epNum) return [];

  const root = await fetchSveltekitData(`/media/${slug}/${epNum}`);
  if (!root) return [];

  const sources: AnimeAV1Source[] = [];
  const embeds: Record<string, any[]> = root.embeds || {};

  for (const [key, lang] of [["DUB", "Latino"], ["SUB", "Sub"]] as const) {
    const arr: any[] = Array.isArray(embeds[key]) ? embeds[key] : [];
    for (const stream of arr) {
      if (stream?.url && !/1fichier\.com/i.test(stream.url)) {
        sources.push({
          server: stream.server || "AnimeAV1",
          url: stream.url,
          lang,
          quality: stream.quality || undefined,
        });
      }
    }
  }

  return sources;
}
