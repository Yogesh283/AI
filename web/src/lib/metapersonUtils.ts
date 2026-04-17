/**
 * MetaPerson / Avatar SDK iframe helpers + a 6-hour verification window.
 *
 * This module does not create avatars or call the Enterprise REST API — it only
 * tracks whether our server credentials endpoint works, so you can re-check later.
 */

export const METAPERSON_VERIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

const STORAGE_KEY = "neo-metaperson-verify";

export type MetapersonVerifyState = {
  /** Last time GET /api/metaperson-credentials returned 200 */
  lastOkAt: number | null;
  lastError: string | null;
};

function readRaw(): MetapersonVerifyState {
  if (typeof window === "undefined") return { lastOkAt: null, lastError: null };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastOkAt: null, lastError: null };
    const p = JSON.parse(raw) as Partial<MetapersonVerifyState>;
    return {
      lastOkAt: typeof p.lastOkAt === "number" ? p.lastOkAt : null,
      lastError: typeof p.lastError === "string" ? p.lastError : null,
    };
  } catch {
    return { lastOkAt: null, lastError: null };
  }
}

function writeRaw(next: MetapersonVerifyState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getMetapersonVerifyState(): MetapersonVerifyState {
  return readRaw();
}

/** Milliseconds until the next *routine* verification window (0 = allowed now). */
export function msUntilRoutineVerifyAllowed(): number {
  const { lastOkAt } = readRaw();
  if (!lastOkAt) return 0;
  const elapsed = Date.now() - lastOkAt;
  return Math.max(0, METAPERSON_VERIFY_COOLDOWN_MS - elapsed);
}

export function recordMetapersonCredentialsOk(): void {
  const cur = readRaw();
  writeRaw({ ...cur, lastOkAt: Date.now(), lastError: null });
}

export function recordMetapersonCredentialsError(message: string): void {
  const cur = readRaw();
  writeRaw({ ...cur, lastError: message });
}

/** Hit the credentials route; updates stored state. */
export async function verifyMetapersonCredentials(): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/metaperson-credentials");
    const j = (await r.json()) as { error?: string; hint?: string; clientId?: string };
    if (!r.ok) {
      const msg = j.hint || j.error || `HTTP ${r.status}`;
      recordMetapersonCredentialsError(msg);
      return { ok: false, error: msg };
    }
    recordMetapersonCredentialsOk();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    recordMetapersonCredentialsError(msg);
    return { ok: false, error: msg };
  }
}

export function formatDurationMs(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
