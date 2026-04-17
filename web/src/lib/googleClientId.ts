/** Cached fetch of web Google OAuth client id (same-origin API). */
let cached: string | null | undefined;

export async function fetchGoogleWebClientId(): Promise<string> {
  if (cached !== undefined) return cached ?? "";
  try {
    const r = await fetch("/api/public/google-client-id", { cache: "no-store" });
    if (!r.ok) {
      cached = "";
      return "";
    }
    const j = (await r.json()) as { clientId?: string };
    const id = typeof j.clientId === "string" ? j.clientId.trim() : "";
    cached = id;
    return id;
  } catch {
    cached = "";
    return "";
  }
}
