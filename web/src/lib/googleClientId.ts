/** Cached fetch of public Google OAuth IDs (same-origin API). */
type GoogleClientConfig = {
  clientId: string;
  androidClientId: string;
};

let cached: GoogleClientConfig | undefined;

export async function fetchGoogleClientConfig(): Promise<GoogleClientConfig> {
  if (cached) return cached;
  const empty: GoogleClientConfig = { clientId: "", androidClientId: "" };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 350 * attempt));
      }
      const r = await fetch("/api/public/google-client-id", { cache: "no-store" });
      if (!r.ok) {
        continue;
      }
      const j = (await r.json()) as { clientId?: string; androidClientId?: string };
      const out: GoogleClientConfig = {
        clientId: typeof j.clientId === "string" ? j.clientId.trim() : "",
        androidClientId: typeof j.androidClientId === "string" ? j.androidClientId.trim() : "",
      };
      cached = out;
      return out;
    } catch {
      /* retry */
    }
  }
  return empty;
}

export async function fetchGoogleWebClientId(): Promise<string> {
  const cfg = await fetchGoogleClientConfig();
  return cfg.clientId;
}
