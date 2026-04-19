/** Cached fetch of web Google OAuth client id (same-origin API). */
let cached: string | null | undefined;

export async function fetchGoogleWebClientId(): Promise<string> {
  if (cached !== undefined) return cached ?? "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 350 * attempt));
      }
      const r = await fetch("/api/public/google-client-id", { cache: "no-store" });
      if (!r.ok) {
        continue;
      }
      const j = (await r.json()) as { clientId?: string };
      const id = typeof j.clientId === "string" ? j.clientId.trim() : "";
      cached = id;
      return id;
    } catch {
      /* retry */
    }
  }
  return "";
}
