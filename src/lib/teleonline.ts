// Teleonline.org scraper
// This module scrapes TV channel listings from teleonline.org
// It uses the WordPress REST API and page scraping to build a channel database

import ZAI from "z-ai-web-dev-sdk";

const BASE_URL = "https://teleonline.org";

interface ChannelInfo {
  slug: string;
  name: string;
  country: string;
  country_slug: string;
  logo?: string;
  url: string;
  post_id?: number;
}

interface CountryInfo {
  name: string;
  slug: string;
  flag_url?: string;
  channel_count?: number;
}

// Cache
let channelsCache: Map<string, ChannelInfo[]> = new Map();
let countriesCache: CountryInfo[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Decrypts Teleonline stream URLs using XOR encryption
 * The key identified is 'token'
 */
function decryptStream(encodedString: string): string {
  try {
    // 1. Base64 decode (standardizing characters)
    const normalized = encodedString.replace(/_/g, '/').replace(/-/g, '+');
    const decoded = Buffer.from(normalized, 'base64').toString('binary');
    
    // 2. XOR with key 'token'
    const key = "token";
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    
    return result;
  } catch (e) {
    console.error("Error decrypting Teleonline stream:", e);
    return "";
  }
}

async function readPage(url: string): Promise<string> {
  const zai = await ZAI.create();
  const result = await zai.functions.invoke("page_reader", { url });
  return result.data.html || "";
}

// Get list of available countries with their channel counts
export async function getCountries(): Promise<CountryInfo[]> {
  if (countriesCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return countriesCache;
  }

  const html = await readPage(`${BASE_URL}/canales/espana/`);

  // Extract country links from the page
  const countryRegex = /href="https:\/\/teleonline\.org\/canales\/([^/]+)\/"/g;
  const countries: Map<string, CountryInfo> = new Map();

  let match;
  while ((match = countryRegex.exec(html)) !== null) {
    const slug = match[1];
    if (!countries.has(slug)) {
      countries.set(slug, {
        name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        slug,
        flag_url: `${BASE_URL}/img/banderas/${getCountryCode(slug)}.png`,
      });
    }
  }

  countriesCache = Array.from(countries.values());
  cacheTimestamp = Date.now();
  return countriesCache;
}

// Get channels for a specific country
export async function getChannelsByCountry(countrySlug: string): Promise<ChannelInfo[]> {
  const cacheKey = `country_${countrySlug}`;
  if (channelsCache.has(cacheKey) && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return channelsCache.get(cacheKey) || [];
  }

  const html = await readPage(`${BASE_URL}/canales/${countrySlug}/`);

  if (!html || html.length < 100) {
    return [];
  }

  // Extract channel links: href="https://teleonline.org/canal/{slug}/"
  const channelRegex = /href="https:\/\/teleonline\.org\/canal\/([^/]+)\/"/g;

  // Also extract titles from the article content
  const titleRegex = /<article[^>]*>[\s\S]*?<a[^>]+href="https:\/\/teleonline\.org\/canal\/[^/]+\/"[^>]*>[\s\S]*?<p[^>]*>([^<]+)<\/p>/g;

  const channels: ChannelInfo[] = [];
  const seen = new Set<string>();

  // Extract from article blocks which have title + link
  const articleRegex = /<article[^>]*class="[^"]*article-loop[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let artMatch;

  while ((artMatch = articleRegex.exec(html)) !== null) {
    const content = artMatch[1];

    // Get link/slug
    const linkMatch = /href="https:\/\/teleonline\.org\/canal\/([^/]+)\/"/.exec(content);
    if (!linkMatch) continue;
    const slug = linkMatch[1];
    if (seen.has(slug)) continue;
    seen.add(slug);

    // Get name from <p> tag
    const nameMatch = /<p[^>]*>([^<]+)<\/p>/.exec(content);
    const name = nameMatch ? nameMatch[1].trim() : slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Get post_id from data attribute
    const postIdMatch = /data-post-id="(\d+)"/.exec(content);
    const post_id = postIdMatch ? parseInt(postIdMatch[1]) : undefined;

    // Get logo
    const logoMatch = /<img[^>]+src="([^"]+)"/.exec(content);
    const logo = logoMatch?.[1];

    channels.push({
      slug,
      name,
      country: countrySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      country_slug: countrySlug,
      logo,
      url: `${BASE_URL}/canal/${slug}/`,
      post_id,
    });
  }

  channelsCache.set(cacheKey, channels);
  return channels;
}

// Search channels across countries
export async function searchChannels(query: string): Promise<ChannelInfo[]> {
  // Search in popular countries
  const popularCountries = ["espana", "mexico", "argentina", "colombia", "chile", "peru", "estados-unidos", "brasil"];

  const allChannels: ChannelInfo[] = [];
  const lowerQuery = query.toLowerCase();

  for (const country of popularCountries) {
    try {
      const channels = await getChannelsByCountry(country);
      const filtered = channels.filter(
        (ch) => ch.name.toLowerCase().includes(lowerQuery) || ch.slug.includes(lowerQuery)
      );
      allChannels.push(...filtered);
    } catch {
      continue;
    }
    if (allChannels.length >= 30) break;
  }

  return allChannels;
}

// Get channel stream page HTML (for extracting stream URLs)
export async function getChannelPage(channelSlug: string): Promise<{
  html: string;
  post_id?: number;
  channel_name: string;
  stream_urls: string[];
  logo?: string;
}> {
  const html = await readPage(`${BASE_URL}/canal/${channelSlug}/`);

  // Extract post_id
  const postIdMatch = /chat_id["\s:=]+(\d+)/.exec(html) || /data-post-id="(\d+)"/.exec(html);
  const post_id = postIdMatch ? parseInt(postIdMatch[1]) : undefined;

  // Extract channel name from title
  const titleMatch = /<title>([^<]+)<\/title>/.exec(html);
  const channel_name = titleMatch ? titleMatch[1].replace(/Teleonline/gi, "").trim() : channelSlug;

  // Extract logo from schema
  const logoMatch = /"logo":\{"@type":"ImageObject","url":"([^"]+)"/.exec(html);
  const logo = logoMatch?.[1];

  // Extract XOR encrypted streams from the page
  // They are usually in scripts like: var stream = "base64_xor_string";
  const streamRegex = /var\s+(?:stream|url|m3u8)\s*=\s*["']([^"']+)["']/g;
  let match;
  const stream_urls: string[] = [];
  
  while ((match = streamRegex.exec(html)) !== null) {
    const decrypted = decryptStream(match[1]);
    if (decrypted && (decrypted.includes(".m3u8") || decrypted.includes("http"))) {
      stream_urls.push(decrypted);
    }
  }

  return { html, post_id, channel_name, stream_urls, logo };
}

// Get EPG (Electronic Program Guide) for a channel
export async function getChannelEPG(postId: number): Promise<{
  success: boolean;
  current?: {
    title: string;
    description: string;
    image: string;
    start: string;
    stop: string;
    duration: number;
    elapsed: number;
    progress: number;
  };
  future?: Array<{
    title: string;
    description: string;
    image: string;
    start: string;
    stop: string;
  }>;
}> {
  try {
    const zai = await ZAI.create();
    const result = await zai.functions.invoke("page_reader", {
      url: `${BASE_URL}/wp-json/teleonline/v1/channel/${postId}`,
    });

    const jsonStr = result.data.html
      .replace(/<[^>]+>/g, "")
      .trim();

    return JSON.parse(jsonStr);
  } catch {
    return { success: false };
  }
}

// Get channel embed URL (iframe-friendly)
export function getChannelEmbedUrl(channelSlug: string): string {
  return `${BASE_URL}/canal/${channelSlug}/`;
}

// Helper: Map country slug to ISO country code for flags
function getCountryCode(slug: string): string {
  const map: Record<string, string> = {
    espana: "es",
    mexico: "mx",
    argentina: "ar",
    colombia: "co",
    chile: "cl",
    peru: "pe",
    "estados-unidos": "us",
    brasil: "br",
    venezuela: "ve",
    ecuador: "ec",
    "republica-dominicana": "do",
    guatemala: "gt",
    cuba: "cu",
    bolivia: "bo",
    "costa-rica": "cr",
    panama: "pa",
    uruguay: "uy",
    "puerto-rico": "pr",
    honduras: "hn",
    "el-salvador": "sv",
    "nicaragua": "ni",
    paraguay: "py",
    alemania: "de",
    francia: "fr",
    "reino-unido": "gb",
    italia: "it",
    portugal: "pt",
    japon: "jp",
    china: "cn",
    india: "in",
    brasil: "br",
    canada: "ca",
    australia: "au",
  };
  return map[slug] || slug.substring(0, 2).toLowerCase();
}
