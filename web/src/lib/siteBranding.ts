/**
 * Site title from request host, or NEXT_PUBLIC_APP_NAME when set.
 * Used for tab title, header logo text, and auth copy.
 */

const DEFAULT_BRAND = "NeoXAI";

function capitalizeWords(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Host without port; strips leading www. */
export function normalizeHost(host: string): string {
  return host.trim().split(":")[0]?.replace(/^www\./i, "").toLowerCase() || "";
}

/**
 * Fixed name from env wins. Localhost / empty → default "NeoXAI".
 * Else: Vercel preview/production host → first label (e.g. my-app.vercel.app → "My App").
 * Typical domain (a.b.tld) → second-level label (often the brand).
 */
export function resolveSiteDisplayName(hostHeader: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_NAME?.trim();
  if (fromEnv) return fromEnv;

  const host = normalizeHost(hostHeader);
  if (!host || host === "localhost" || host === "127.0.0.1") return DEFAULT_BRAND;

  const parts = host.split(".").filter(Boolean);
  if (parts.length === 0) return DEFAULT_BRAND;
  if (parts.length === 1) return capitalizeWords(parts[0]);

  const isVercelApp =
    parts.length >= 3 &&
    parts[parts.length - 2] === "vercel" &&
    parts[parts.length - 1] === "app";

  if (isVercelApp) {
    return capitalizeWords(parts[0]);
  }

  if (parts.length === 2) {
    return capitalizeWords(parts[0]);
  }

  return capitalizeWords(parts[parts.length - 2]);
}
