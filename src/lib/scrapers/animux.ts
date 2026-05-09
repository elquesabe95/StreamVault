import { readPage, readJson } from "./client";

const BASE_URL = "https://animux.site";
const FIRESTORE_API_KEY = "AIzaSyC0ROz4tvDU9sg60cfcXV6mCo3vPjGLfPg";
const FIRESTORE_PROJECT_ID = "barbers-9b523";

export interface AnimuxChannel {
  id: string;
  name: string;
  category: string;
  url: string;
  logo?: string;
}

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
  nullValue?: null;
};

function normalizeCategory(category?: string): string {
  if (!category) return "General";
  const value = category.toLowerCase().trim();
  const map: Record<string, string> = {
    sports: "Deportes",
    sport: "Deportes",
    news: "Noticias",
    entertainment: "Entretenimiento",
    movies: "Cine",
    movie: "Cine",
    music: "Musica",
    kids: "Infantil",
    children: "Infantil",
    documentary: "Documentales",
    documentaries: "Documentales",
    religious: "Religioso",
    religion: "Religioso",
    education: "Educacion",
    educational: "Educacion",
    comedy: "Comedia",
    drama: "Drama",
    general: "General",
    culture: "Cultura",
    series: "Series",
    nacionales: "Nacionales",
  };

  return map[value] || category.split(";")[0].trim() || "General";
}

function firestoreValueToJs(value?: FirestoreValue): any {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return value.arrayValue?.values?.map(firestoreValueToJs) || [];
  if ("mapValue" in value) return firestoreFieldsToJs(value.mapValue?.fields || {});
  return null;
}

function firestoreFieldsToJs(fields: Record<string, FirestoreValue>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, firestoreValueToJs(value)])
  );
}

function toAnimuxChannel(raw: any, fallbackCategory = "General"): AnimuxChannel | null {
  const name = raw.name || raw.displayName || raw.title;
  const url = raw.url || raw.stream || raw.src || raw.link;
  if (!name || !url || raw.isVOD) return null;

  return {
    id: String(raw.id || raw.name || raw.title || url),
    name: String(name),
    category: normalizeCategory(raw.category || fallbackCategory),
    url: String(url),
    logo: raw.logo || raw.img || raw.image || raw.poster,
  };
}

async function getAnimuxFirestoreChannels(): Promise<AnimuxChannel[]> {
  const channels: AnimuxChannel[] = [];
  let pageToken = "";

  for (let page = 0; page < 20; page++) {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const url =
      `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}` +
      `/databases/(default)/documents/channels?key=${FIRESTORE_API_KEY}&pageSize=100${tokenParam}`;

    const data = await readJson<any>(url);
    const documents = Array.isArray(data?.documents) ? data.documents : [];
    if (documents.length === 0) break;

    for (const doc of documents) {
      const fields = firestoreFieldsToJs(doc.fields || {});
      const id = String(doc.name || "").split("/").pop() || fields.id;
      const channel = toAnimuxChannel({ ...fields, id }, fields.category);
      if (channel) channels.push(channel);
    }

    pageToken = data.nextPageToken || "";
    if (!pageToken) break;
  }

  return channels;
}

/**
 * Get all available channels from Animux
 * Using the official channels.json endpoint and fallback to DOM/Regex
 */
export async function getAnimuxChannels(): Promise<AnimuxChannel[]> {
  console.log("[Animux] Fetching full catalog...");

  const endpoints = [
    "m3u_channels.json",
    "channels.json",
    "all.json",
    "sports.json",
    "tv.json",
    "tvabierta.json"
  ];

  const allChannels: AnimuxChannel[] = [];
  const seenIds = new Set<string>();

  const addChannel = (channel: AnimuxChannel | null) => {
    if (!channel) return;
    const dedupeKey = `${channel.name.toLowerCase().trim()}|${channel.url.trim()}`;
    if (seenIds.has(dedupeKey)) return;
    seenIds.add(dedupeKey);
    allChannels.push(channel);
  };

  try {
    const firestoreChannels = await getAnimuxFirestoreChannels();
    console.log(`[Animux] Loaded ${firestoreChannels.length} channels from Firestore`);
    firestoreChannels.forEach(addChannel);
  } catch (error) {
    console.warn("[Animux] Firestore catalog failed, falling back to JSON:", error);
  }

  for (const endpoint of endpoints) {
    try {
      const url = `${BASE_URL}/${endpoint}`;
      const jsonData = await readJson<any>(url);

      const channelsList = jsonData?.channels || (Array.isArray(jsonData) ? jsonData : null);

      if (channelsList && Array.isArray(channelsList)) {
        console.log(`[Animux] Loaded ${channelsList.length} channels from ${endpoint}`);
        channelsList.forEach((ch: any) => {
          addChannel(toAnimuxChannel(ch, endpoint.replace(".json", "").replace(/\b\w/g, c => c.toUpperCase())));
        });
      }
    } catch (error) {
      console.warn(`[Animux] Failed loading ${endpoint}:`, error);
    }
  }

  console.log(`[Animux] Total channels aggregated: ${allChannels.length}`);
  return allChannels.sort((a, b) => {
    const cat = a.category.localeCompare(b.category);
    if (cat !== 0) return cat;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get the direct stream URL for an Animux channel
 */
export async function getAnimuxStream(channelUrl: string): Promise<string> {
  // If it's already an m3u8, return it
  if (channelUrl.includes(".m3u8")) return channelUrl;
  
  console.log(`[Animux] Resolving stream for: ${channelUrl}`);
  const html = await readPage(channelUrl);
  
  // Look for the stream URL in the HTML or scripts
  // Patterns: 
  // "src": "http://.../index.m3u8"
  // var stream = "http://.../index.m3u8"
  const streamRegex = /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/;
  const match = streamRegex.exec(html);
  
  if (match) {
    console.log(`[Animux] Found m3u8 in HTML: ${match[1]}`);
    return match[1];
  }

  // Look for iframe
  const iframeRegex = /<iframe[^>]+src="([^"]+)"/;
  const iframeMatch = iframeRegex.exec(html);
  
  if (iframeMatch) {
    const iframeUrl = iframeMatch[1];
    console.log(`[Animux] Found iframe: ${iframeUrl}`);
    // If the iframe is already an m3u8 (unlikely but possible)
    if (iframeUrl.includes(".m3u8")) return iframeUrl;
    
    // We could recursively resolve the iframe, but let's try a common proxy pattern first
    if (iframeUrl.includes("/play/")) {
      // Extract the ID and try to build the proxy URL
      const idMatch = /\/play\/([^/?]+)/.exec(iframeUrl);
      if (idMatch) {
        const proxyUrl = `http://181.78.8.199:8000/play/${idMatch[1]}/index.m3u8`;
        console.log(`[Animux] Guessing proxy URL: ${proxyUrl}`);
        return proxyUrl;
      }
    }
    return iframeUrl;
  }

  // Last ditch effort: search for anything that looks like an HLS stream in any script
  const scriptRegex = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g;
  const scriptMatches = html.match(scriptRegex);
  if (scriptMatches && scriptMatches.length > 0) {
    console.log(`[Animux] Found m3u8 in scripts: ${scriptMatches[0]}`);
    return scriptMatches[0];
  }
  
  return channelUrl;
}
