import { getChannelsByCountry, getCountries } from "../teleonline";
import { readPage } from "./client";

const BASE_URL = "https://teleonline.org";

export interface TeleOnlineChannel {
  name: string;
  slug: string;
  url: string;
  logo?: string;
}

/**
 * DEPRECATED: Use src/lib/teleonline.ts instead
 * Get all available channels from TeleOnline
 */
export async function getTeleOnlineChannels(): Promise<TeleOnlineChannel[]> {
  const channels = await getChannelsByCountry("espana"); // Fallback to Spain or similar
  return channels.map(ch => ({
    name: ch.name,
    slug: ch.slug,
    url: ch.url,
    logo: ch.logo
  }));
}

/**
 * DEPRECATED: Use src/lib/teleonline.ts instead
 */
export async function getTeleOnlineChannelsByCountry(country: string): Promise<TeleOnlineChannel[]> {
  const channels = await getChannelsByCountry(country);
  return channels.map(ch => ({
    name: ch.name,
    slug: ch.slug,
    url: ch.url,
    logo: ch.logo
  }));
}

/**
 * Get the stream URL for a TeleOnline channel
 * This site uses iframes often, so we extract the iframe src
 */
export async function getTeleOnlineStream(channelSlug: string): Promise<string> {
  const url = `${BASE_URL}/canal/${channelSlug}/`;
  const html = await readPage(url);

  const resolvePlaylistUrl = async (playlistUrl: string) => {
    if (!playlistUrl.includes(".json")) return playlistUrl;

    try {
      const playlistText = await readPage(playlistUrl);
      const playlist = JSON.parse(playlistText);
      if (Array.isArray(playlist)) {
        const playable = playlist.find((item) =>
          typeof item?.url === "string" &&
          (item.url.includes(".m3u8") || item.url.includes(".mp4") || item.url.startsWith("http"))
        );
        if (playable?.url) return playable.url;
      }
    } catch (e) {
      console.warn("TeleOnline playlist parse failed:", e);
    }

    return playlistUrl;
  };
  
  // Look for iframe src
  const iframeRegex = /<iframe[^>]+src="([^"]+)"/;
  const match = iframeRegex.exec(html);
  
  if (match) {
    let streamUrl = match[1];
    // Sometimes the URL is relative or protocol-less
    if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
    return resolvePlaylistUrl(streamUrl);
  }
  
  // Fallback 1: look for window.atob base64 string
  const atobRegex = /window\.atob\(['"]([^'"]+)['"]\)/;
  const atobMatch = atobRegex.exec(html);
  if (atobMatch) {
    try {
      const decoded = Buffer.from(atobMatch[1], 'base64').toString('utf-8');
      if (decoded.includes('.m3u8') || decoded.includes('http')) {
        return resolvePlaylistUrl(decoded);
      }
    } catch (e) {}
  }
  
  // Fallback 2: look for direct m3u8
  const m3u8Regex = /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/;
  const m3u8Match = m3u8Regex.exec(html);
  
  return m3u8Match ? m3u8Match[1] : url;
}
