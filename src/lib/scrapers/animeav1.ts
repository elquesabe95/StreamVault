import { runInNewContext } from "node:vm";
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

function extractBalancedSection(text: string, startIndex: number, openChar: string, closeChar: string) {
  let depth = 0;
  let activeQuote = "";
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (activeQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === activeQuote) activeQuote = "";
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      activeQuote = character;
      continue;
    }
    if (character === openChar) depth += 1;
    if (character === closeChar) {
      depth -= 1;
      if (depth === 0) return text.slice(startIndex, index + 1);
    }
  }

  return null;
}

function safeEvaluate(expression: string) {
  try {
    return runInNewContext(expression, Object.create(null), {
      timeout: 1000,
      displayErrors: false,
    });
  } catch {
    return null;
  }
}

function extractSvelteData(html: string): any[] | null {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1] || "");

  for (const scriptContent of scripts) {
    if (!scriptContent.includes("__sveltekit_") || !scriptContent.includes("data:")) continue;

    let pointer = scriptContent.indexOf("__sveltekit_");
    while (pointer !== -1) {
      const equalsPosition = scriptContent.indexOf("=", pointer);
      if (equalsPosition === -1) break;

      const objectStart = scriptContent.indexOf("{", equalsPosition);
      if (objectStart === -1) break;

      const objectLiteral = extractBalancedSection(scriptContent, objectStart, "{", "}");
      if (objectLiteral) {
        const payload = safeEvaluate(`(${objectLiteral})`);
        if (payload && Array.isArray(payload.data)) return payload.data;
      }

      pointer = scriptContent.indexOf("__sveltekit_", pointer + "__sveltekit_".length);
    }

    const dataMarker = scriptContent.indexOf("data:");
    const listStart = dataMarker === -1 ? -1 : scriptContent.indexOf("[", dataMarker);
    if (listStart !== -1) {
      const listLiteral = extractBalancedSection(scriptContent, listStart, "[", "]");
      if (listLiteral) {
        const payloadData = safeEvaluate(`(${listLiteral})`);
        if (Array.isArray(payloadData)) return payloadData;
      }
    }
  }

  return null;
}

function walk(value: any, visitor: (node: any) => void, seen = new Set<any>()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  visitor(value);

  if (Array.isArray(value)) {
    value.forEach(child => walk(child, visitor, seen));
    return;
  }

  Object.values(value).forEach(child => walk(child, visitor, seen));
}

function resolveAbsoluteUrl(urlCandidate?: string | null) {
  if (!urlCandidate || typeof urlCandidate !== "string") return null;
  try {
    return new URL(urlCandidate, BASE_URL).toString();
  } catch {
    return null;
  }
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function chooseLikelySearchArray(dataRoot: any[]) {
  let bestArray: any[] | null = null;
  let bestScore = -1;

  walk(dataRoot, node => {
    if (!Array.isArray(node) || node.length === 0 || node.length > 300) return;

    let objectItems = 0;
    let totalScore = 0;
    for (const item of node) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      objectItems += 1;
      let score = 0;
      if (typeof item.title === "string" || typeof item.name === "string") score += 2;
      if (typeof item.slug === "string" || typeof item.url === "string") score += 2;
      if (item.poster || item.image || item.backdrop) score += 1;
      if (item.category || item.type) score += 1;
      totalScore += score;
    }

    if (objectItems === 0) return;
    const averageScore = totalScore / objectItems;
    if (averageScore > bestScore) {
      bestScore = averageScore;
      bestArray = node;
    }
  });

  return bestScore >= 2 ? bestArray : null;
}

function mapSearchResults(array: any[], query: string): AnimeAV1Result[] {
  const normalizedQuery = normalizeText(query);
  const results = array
    .map(item => {
      if (!item || typeof item !== "object") return null;
      const title = item.title || item.name;
      if (!title) return null;

      const slug = item.slug || null;
      const url = resolveAbsoluteUrl(item.url || item.href || (slug ? `/media/${slug}` : null));
      if (!url) return null;

      return {
        title,
        slug: slug || url,
        url,
        image: resolveAbsoluteUrl(item.poster || item.image || item.cover) || undefined,
        type: "anime",
      };
    })
    .filter(Boolean) as AnimeAV1Result[];

  return results
    .map(result => {
      const title = normalizeText(result.title);
      const slug = normalizeText(result.slug);
      let score = 0;
      if (title === normalizedQuery || slug === normalizedQuery) score += 5;
      if (title.includes(normalizedQuery) || slug.includes(normalizedQuery)) score += 3;
      for (const term of normalizedQuery.split(/\s+/)) {
        if (term.length > 1 && `${title} ${slug}`.includes(term)) score += 1;
      }
      return { result, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.result)
    .slice(0, 20);
}

export async function searchAnimeAV1(query: string): Promise<AnimeAV1Result[]> {
  const urls = [
    `${BASE_URL}/catalogo?search=${encodeURIComponent(query)}`,
    `${BASE_URL}/catalogo?q=${encodeURIComponent(query)}`,
  ];

  for (const searchUrl of urls) {
    const html = await readPage(searchUrl);
    const data = extractSvelteData(html);
    if (data) {
      const array = chooseLikelySearchArray(data);
      if (array) {
        const results = mapSearchResults(array, query);
        if (results.length > 0) return results;
      }
    }

    const htmlResults = [...html.matchAll(/<a[^>]+href=["'](\/media\/[^"'/]+)["'][^>]*>([\s\S]*?)<\/a>/g)]
      .map(match => {
        const url = resolveAbsoluteUrl(match[1]);
        const content = match[2];
        const title = /<h[23][^>]*>([^<]+)<\/h[23]>/.exec(content)?.[1] || /alt=["']([^"']+)["']/.exec(content)?.[1];
        if (!url || !title) return null;
        return { title: title.trim(), slug: match[1].replace("/media/", ""), url, type: "anime" };
      })
      .filter(Boolean) as AnimeAV1Result[];

    if (htmlResults.length > 0) return htmlResults;
  }

  return [];
}

export async function getAnimeAV1Episodes(url: string): Promise<AnimeAV1Episode[]> {
  const animeUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  const html = await readPage(animeUrl);
  const data = extractSvelteData(html);
  const episodes: AnimeAV1Episode[] = [];

  walk(data || {}, node => {
    if (!node || typeof node !== "object" || !Array.isArray(node.episodes)) return;
    for (const episode of node.episodes) {
      const number = Number(episode.number ?? episode.episode ?? episode.ep);
      const episodeUrl = resolveAbsoluteUrl(episode.url || episode.href || episode.link || (Number.isFinite(number) ? `${new URL(animeUrl).pathname}/${number}` : null));
      if (Number.isFinite(number) && episodeUrl) {
        episodes.push({
          number,
          title: episode.title || `Episodio ${number}`,
          url: episodeUrl,
        });
      }
    }
  });

  if (episodes.length === 0) {
    const epRegex = /href=["'](\/media\/[^"']+\/(\d+))["']/g;
    let match;
    while ((match = epRegex.exec(html)) !== null) {
      episodes.push({
        number: Number(match[2]),
        title: `Episodio ${match[2]}`,
        url: `${BASE_URL}${match[1]}`,
      });
    }
  }

  const seen = new Set<string>();
  return episodes
    .filter(episode => {
      if (seen.has(episode.url)) return false;
      seen.add(episode.url);
      return true;
    })
    .sort((a, b) => a.number - b.number);
}

function normalizeLink(entry: any, lang: "Latino" | "Sub"): AnimeAV1Source | null {
  if (!entry) return null;
  const url = resolveAbsoluteUrl(typeof entry === "string" ? entry : entry.url || entry.href || entry.link || entry.embed || entry.file || entry.source);
  if (!url) return null;
  return {
    server: entry.server || entry.name || entry.provider || "AnimeAV1",
    url,
    lang,
    quality: entry.quality || entry.resolution || entry.label || undefined,
  };
}

function collectVariantLinks(container: any, target: AnimeAV1Source[]) {
  if (!container || typeof container !== "object") return;

  const variants: Array<["SUB" | "DUB", "Sub" | "Latino"]> = [["DUB", "Latino"], ["SUB", "Sub"]];
  for (const [key, lang] of variants) {
    const value = container[key] || container[key.toLowerCase()];
    if (!value) continue;

    if (Array.isArray(value)) {
      value.forEach(entry => {
        const link = normalizeLink(entry, lang);
        if (link) target.push(link);
      });
      continue;
    }

    if (typeof value === "object") {
      Object.values(value).forEach(child => {
        if (Array.isArray(child)) {
          child.forEach(entry => {
            const link = normalizeLink(entry, lang);
            if (link) target.push(link);
          });
        } else {
          const link = normalizeLink(child, lang);
          if (link) target.push(link);
        }
      });
    }
  }
}

export async function getAnimeAV1Servers(url: string): Promise<AnimeAV1Source[]> {
  const episodeUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  const html = await readPage(episodeUrl);
  const data = extractSvelteData(html);
  const sources: AnimeAV1Source[] = [];

  walk(data || {}, node => {
    if (!node || typeof node !== "object") return;
    collectVariantLinks(node.streamLinks, sources);
    collectVariantLinks(node.servers, sources);
    if (Object.prototype.hasOwnProperty.call(node, "SUB") || Object.prototype.hasOwnProperty.call(node, "DUB")) {
      collectVariantLinks(node, sources);
    }
  });

  if (sources.length === 0) {
    const urlMatches = html.match(/https?:\/\/(?:www\.)?(?:pixeldrain\.com|mega\.nz|mp4upload\.com|1fichier\.com|player\.[^\s"'<>]+|[^\s"'<>]*zilla[^\s"'<>]*|[^\s"'<>]*uns\.bio[^\s"'<>]*)[^\s"'<>]*/gi) || [];
    urlMatches.forEach(rawUrl => {
      const url = resolveAbsoluteUrl(rawUrl);
      if (url) sources.push({ server: "AnimeAV1", url, lang: "Sub" });
    });
  }

  const seen = new Set<string>();
  return sources.filter(source => {
    if (/1fichier\.com/i.test(source.url)) return false;
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}
