import ZAI from "z-ai-web-dev-sdk";

const BASE_URL = "https://animux.site";

export interface AnimuxChannel {
  id: string;
  name: string;
  category: string;
  url: string;
  logo?: string;
}

async function readPage(url: string): Promise<string> {
  const zai = await ZAI.create();
  const result = await zai.functions.invoke("page_reader", { url });
  return result.data.html || "";
}

/**
 * Get all available channels from Animux
 * Note: Animux is a SPA, so we might need to look for embedded JSON or data structures
 */
export async function getAnimuxChannels(): Promise<AnimuxChannel[]> {
  const html = await readPage(BASE_URL);
  const channels: AnimuxChannel[] = [];
  
  // Looking for the JSON data that populates the SPA
  // Often stored in a script tag or as a global variable
  const dataRegex = /const\s+channels\s*=\s*(\[[\s\S]*?\]);/ || /data:\s*(\[[\s\S]*?\])/;
  const match = dataRegex.exec(html);
  
  if (match) {
    try {
      const rawData = JSON.parse(match[1]);
      // Map raw data to AnimuxChannel format
      return rawData.map((ch: any) => ({
        id: ch.id || ch.name,
        name: ch.name,
        category: ch.category || "General",
        url: ch.url || "",
        logo: ch.logo
      }));
    } catch (e) {
      console.error("Error parsing Animux data:", e);
    }
  }

  // Fallback: Extract from HTML if JSON is not found
  const channelItemRegex = /<div[^>]*class="[^"]*channel-card[^"]*"[^>]*data-url="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g;
  let itemMatch;
  while ((itemMatch = channelItemRegex.exec(html)) !== null) {
    const [_, url, content] = itemMatch;
    const nameMatch = /<h3[^>]*>([^<]+)<\/h3>/.exec(content);
    if (nameMatch) {
      channels.push({
        id: nameMatch[1],
        name: nameMatch[1].trim(),
        category: "TV Abierta",
        url: url
      });
    }
  }
  
  return channels;
}

/**
 * Get the direct stream URL for an Animux channel
 * Some URLs are direct, others might need a proxy resolution
 */
export async function getAnimuxStream(channelUrl: string): Promise<string> {
  // If it's already an m3u8, return it
  if (channelUrl.includes(".m3u8")) return channelUrl;
  
  // If it's a page, we might need to read it to find the stream
  const html = await readPage(channelUrl);
  const streamRegex = /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/;
  const match = streamRegex.exec(html);
  
  return match ? match[1] : channelUrl;
}
