/**
 * The origin a browser can actually reach.
 *
 * Render runs the standalone server bound to 0.0.0.0:10000 — HOSTNAME=0.0.0.0 is
 * required there, since Render otherwise sets it to the container hostname and
 * the server becomes unreachable. The side effect is that
 * `new URL(req.url).origin` evaluates to "https://0.0.0.0:10000", so every
 * proxied source URL and every rewritten playlist entry built from it points at
 * an address no client can load, and playback fails with the sources in hand.
 *
 * The reachable origin comes from the forwarding headers the platform sets.
 */
export function publicOrigin(req: Request): string {
  const h = req.headers;
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();

  // No usable Host header (direct hit, tests): fall back to the request URL.
  if (!host || host.startsWith("0.0.0.0")) return new URL(req.url).origin;

  const proto = (h.get("x-forwarded-proto") || "").split(",")[0].trim()
    || (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host) ? "http" : "https");

  return `${proto}://${host}`;
}
