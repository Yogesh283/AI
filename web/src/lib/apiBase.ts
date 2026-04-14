/**
 * Browser API base for NeoXAI.
 *
 * On a real domain (not localhost), we MUST return same-origin `/neo-api` first,
 * without reading `process.env.NEXT_PUBLIC_API_URL`. Next inlines that env at build time;
 * a bad value (e.g. https://127.0.0.1:8010) caused ERR_SSL_PROTOCOL_ERROR in production.
 */

function strip(u: string): string {
  return u.replace(/\/$/, "");
}

function isLoopbackApiUrl(u: string): boolean {
  const s = u.trim();
  if (!s) return false;
  try {
    const parsed = new URL(s.includes("://") ? s : `http://${s}`);
    const h = parsed.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return /127\.0\.0\.1|localhost/i.test(s);
  }
}

function isPublicSiteHostname(h: string): boolean {
  const x = h.toLowerCase();
  return x !== "localhost" && x !== "127.0.0.1" && x !== "[::1]";
}

/**
 * Use this for fetch() URLs.
 * On myneoxai.com (any non-loopback host) in the browser: return `/neo-api` immediately — do not
 * call `getApiBase()` first, so inlined `NEXT_PUBLIC_API_URL` can never produce `https://127.0.0.1:8010/...` (ERR_SSL_PROTOCOL_ERROR).
 */
export function apiOrigin(): string {
  if (typeof window !== "undefined" && isPublicSiteHostname(window.location.hostname)) {
    return "/neo-api";
  }
  const b = getApiBase().replace(/\/$/, "") || "/neo-api";
  if (typeof window !== "undefined" && /127\.0\.0\.1|localhost/i.test(b)) {
    return "/neo-api";
  }
  return b;
}

export function getApiBase(): string {
  // --- Live site: never touch NEXT_PUBLIC (avoids baked loopback in client bundle) ---
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (isPublicSiteHostname(h)) {
      // Relative path only — browser always uses current origin; cannot become 127.0.0.1
      return "/neo-api";
    }
  }

  // --- SSR (RSC) / prerender: no window ---
  if (typeof window === "undefined") {
    const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (!raw || isLoopbackApiUrl(raw)) return "/neo-api";
    return strip(raw);
  }

  // --- Next dev on localhost only ---
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  const origin = strip(window.location.origin);
  if (!raw || isLoopbackApiUrl(raw)) {
    return `${origin}/neo-api`;
  }
  return strip(raw);
}
