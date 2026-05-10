// Teleonline.org scraper
// This module scrapes TV channel listings from teleonline.org
// It uses the WordPress REST API and page scraping to build a channel database

import { readJson, readPage } from "./scrapers/client";

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

interface WpCategory {
  id: number;
  count: number;
  link: string;
  name: string;
  slug: string;
}

interface WpPost {
  id: number;
  slug: string;
  link: string;
  title?: { rendered?: string };
  featured_media?: number;
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      media_details?: {
        sizes?: Record<string, { source_url?: string }>;
      };
    }>;
  };
}

// Cache
let channelsCache: Map<string, ChannelInfo[]> = new Map();
let countriesCache: CountryInfo[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1 * 60 * 1000; // 1 minute

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function titleFromSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getFeaturedImage(post: WpPost): string | undefined {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  return (
    media?.media_details?.sizes?.medium?.source_url ||
    media?.media_details?.sizes?.thumbnail?.source_url ||
    media?.source_url
  );
}

async function getWpCategories(): Promise<WpCategory[]> {
  const categories: WpCategory[] = [];

  for (let page = 1; page <= 10; page++) {
    const url = `${BASE_URL}/wp-json/wp/v2/categories?per_page=100&page=${page}`;
    const data = await readJson<WpCategory[]>(url);
    if (!Array.isArray(data) || data.length === 0) break;
    categories.push(...data);
    if (data.length < 100) break;
  }

  return categories.filter((category) => category.link?.includes("/canales/"));
}

async function getCountryCategory(countrySlug: string): Promise<WpCategory | null> {
  const direct = await readJson<WpCategory[]>(
    `${BASE_URL}/wp-json/wp/v2/categories?slug=${encodeURIComponent(countrySlug)}`
  );
  const category = Array.isArray(direct)
    ? direct.find((item) => item.slug === countrySlug && item.link?.includes("/canales/"))
    : null;

  if (category) return category;

  const categories = await getWpCategories();
  return categories.find((item) => item.slug === countrySlug) || null;
}

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



// Get list of available countries with their channel counts
export async function getCountries(): Promise<CountryInfo[]> {
  if (countriesCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return countriesCache;
  }

  const countries: Map<string, CountryInfo> = new Map();

  try {
    const wpCountries = await getWpCategories();
    for (const country of wpCountries) {
      countries.set(country.slug, {
        name: decodeHtml(country.name) || titleFromSlug(country.slug),
        slug: country.slug,
        flag_url: `${BASE_URL}/img/banderas/${getCountryCode(country.slug)}.png`,
        channel_count: country.count,
      });
    }
  } catch (error) {
    console.warn("[TeleOnline] WordPress countries failed, falling back to HTML:", error);
  }

  if (countries.size === 0) {
    const html = await readPage(`${BASE_URL}/canales/espana/`, {}, true);
    const countryRegex = /href=["']https:\/\/teleonline\.org\/canales\/([^/]+)\/["'][^>]*>([\s\S]*?)<\/a>/g;

    let match;
    while ((match = countryRegex.exec(html)) !== null) {
      const slug = match[1];
      const name = decodeHtml(match[2]) || titleFromSlug(slug);
      if (!countries.has(slug)) {
        countries.set(slug, {
          name,
          slug,
          flag_url: `${BASE_URL}/img/banderas/${getCountryCode(slug)}.png`,
        });
      }
    }
  }

  countriesCache = Array.from(countries.values()).sort((a, b) => a.name.localeCompare(b.name));
  cacheTimestamp = Date.now();
  return countriesCache;
}

// Get channels for a specific country with pagination support
export async function getChannelsByCountry(countrySlug: string): Promise<ChannelInfo[]> {
  const cacheKey = `country_${countrySlug}`;
  if (channelsCache.has(cacheKey) && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return channelsCache.get(cacheKey) || [];
  }

  const allChannels: ChannelInfo[] = [];
  const seen = new Set<string>();

  try {
    const category = await getCountryCategory(countrySlug);
    if (category) {
      const countryName = decodeHtml(category.name) || titleFromSlug(countrySlug);

      for (let page = 1; page <= 20; page++) {
        const posts = await readJson<WpPost[]>(
          `${BASE_URL}/wp-json/wp/v2/posts?categories=${category.id}&per_page=100&page=${page}&_embed=wp:featuredmedia`
        );

        if (!Array.isArray(posts) || posts.length === 0) break;

        for (const post of posts) {
          const slug = post.slug || post.link?.match(/\/canal\/([^/]+)\//)?.[1];
          if (!slug || seen.has(slug)) continue;
          seen.add(slug);

          allChannels.push({
            slug,
            name: decodeHtml(post.title?.rendered || "") || titleFromSlug(slug),
            country: countryName,
            country_slug: countrySlug,
            logo: getFeaturedImage(post),
            url: `${BASE_URL}/canal/${slug}/`,
            post_id: post.id,
          });
        }

        if (posts.length < 100) break;
      }

      if (allChannels.length > 0) {
        channelsCache.set(cacheKey, allChannels);
        return allChannels;
      }
    }

    const urlPatterns = [
      `${BASE_URL}/canales/${countrySlug}/`,
      `${BASE_URL}/${countrySlug}/`
    ];

    let successUrl = "";
    for (const url of urlPatterns) {
      console.log(`[TeleOnline] Trying pattern: ${url}`);
      const html = await readPage(url, {}, true);
      if (html && html.length > 500) {
        extractChannelsFromHtml(html, countrySlug, allChannels, seen);
        if (allChannels.length > 0) {
          successUrl = url;
          break;
        }
      }
    }

    if (!successUrl) {
      console.warn(`[TeleOnline] No channels found for ${countrySlug} with any pattern.`);
      return [];
    }

    // 2. Detect total pages from the first successful page
    // Note: We already have the first page HTML, but let's re-read if needed or reuse
    // For simplicity, I'll just reuse the one I got if I can, but I'll re-read to get the full HTML again for page detection
    const firstPageHtml = await readPage(successUrl, {}, true);
    const pageRegex = /href="https:\/\/teleonline\.org\/canales\/[^/]+\/page\/(\d+)\/"/g;
    let maxPage = 1;
    let pageMatch;
    while ((pageMatch = pageRegex.exec(firstPageHtml)) !== null) {
      const pageNum = parseInt(pageMatch[1]);
      if (pageNum > maxPage) maxPage = pageNum;
    }

    console.log(`[TeleOnline] Detected ${maxPage} pages for ${countrySlug}`);

    // 3. Fetch remaining pages
    const pageLimit = Math.min(maxPage, 20); // Safety limit
    for (let p = 2; p <= pageLimit; p++) {
      const pageUrl = `${successUrl}page/${p}/`;
      const pageHtml = await readPage(pageUrl, {}, true);
      if (pageHtml) {
        extractChannelsFromHtml(pageHtml, countrySlug, allChannels, seen);
      }
    }
  } catch (error) {
    console.error(`Error fetching channels for ${countrySlug}:`, error);
  }

  channelsCache.set(cacheKey, allChannels);
  return allChannels;
}

// Helper function to extract channels from a page's HTML
function extractChannelsFromHtml(html: string, countrySlug: string, channels: ChannelInfo[], seen: Set<string>) {
  const countryName = titleFromSlug(countrySlug);
  
  // Extract from article blocks which have title + link + logo
  const articleRegex = /<article[^>]*class="[^"]*article-loop[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let artMatch;

  while ((artMatch = articleRegex.exec(html)) !== null) {
    const content = artMatch[1];

    // Get link/slug
    const linkMatch = /href=["']https:\/\/teleonline\.org\/canal\/([^/'"]+)\/?["']/.exec(content);
    if (!linkMatch) continue;
    const slug = linkMatch[1];
    if (seen.has(slug)) continue;
    seen.add(slug);

    // Get name from <p> tag
    const nameMatch = /<p[^>]*>([^<]+)<\/p>/.exec(content) || /<span[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([^<]+)<\/span>/.exec(content);
    const name = nameMatch ? decodeHtml(nameMatch[1]) : titleFromSlug(slug);

    // Get post_id from data attribute
    const postIdMatch = /data-post-id="(\d+)"/.exec(content);
    const post_id = postIdMatch ? parseInt(postIdMatch[1]) : undefined;

    // Get logo from background-image style
    const logoMatch = /background-image:\s*url\(['"]?([^'")]+)['"]?\)/.exec(content) || /(?:data-src|src)=["']([^"']+\.(?:png|jpe?g|webp|svg)[^"']*)["']/i.exec(content);
    const logo = logoMatch?.[1];

    channels.push({
      slug,
      name,
      country: countryName,
      country_slug: countrySlug,
      logo,
      url: `${BASE_URL}/canal/${slug}/`,
      post_id,
    });
  }
}

// Search channels across countries
export async function searchChannels(query: string): Promise<ChannelInfo[]> {
  const allChannels: ChannelInfo[] = [];
  const seen = new Set<string>();

  try {
    for (let page = 1; page <= 3; page++) {
      const posts = await readJson<WpPost[]>(
        `${BASE_URL}/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&per_page=100&page=${page}&_embed=wp:featuredmedia`
      );

      if (!Array.isArray(posts) || posts.length === 0) break;

      for (const post of posts) {
        const slug = post.slug || post.link?.match(/\/canal\/([^/]+)\//)?.[1];
        if (!slug || seen.has(slug) || !post.link?.includes("/canal/")) continue;
        seen.add(slug);

        allChannels.push({
          slug,
          name: decodeHtml(post.title?.rendered || "") || titleFromSlug(slug),
          country: "TeleOnline",
          country_slug: "teleonline",
          logo: getFeaturedImage(post),
          url: `${BASE_URL}/canal/${slug}/`,
          post_id: post.id,
        });
      }

      if (posts.length < 100) break;
    }
  } catch (error) {
    console.warn(`[TeleOnline] WordPress search failed for ${query}:`, error);
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
  const html = await readPage(`${BASE_URL}/canal/${channelSlug}/`, {}, true);

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
