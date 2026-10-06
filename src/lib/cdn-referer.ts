// Shared by the video proxy and by embed-serve's stream probe, so the probe
// sends exactly the headers the proxy will send when the player asks for it.
export const CDN_REFERERS: Record<string, string> = {
  "acek-cdn.com": "https://awish.pro/",
  "dramiyos-cdn.com": "https://awish.pro/",
  "filemoon.sx": "https://filemoon.sx/",
  "vidhide.com": "https://vidhide.com/",
  "streamtape.com": "https://streamtape.com/",
  "dood.to": "https://dood.to/",
  "voe.sx": "https://voe.sx/",
  "voe-network.net": "https://voe.sx/",
  "tiviplex.com": "https://voe.sx/",
};

export function getReferer(url: string, custom?: string | null): string {
  if (custom) return custom;
  try {
    const host = new URL(url).hostname;
    for (const [domain, ref] of Object.entries(CDN_REFERERS)) {
      if (host.includes(domain)) return ref;
    }
  } catch {}
  return "";
}
