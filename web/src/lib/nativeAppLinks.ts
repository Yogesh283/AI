/**
 * Open WhatsApp / Telegram / YouTube as **installed apps** on Capacitor Android,
 * instead of navigating the WebView to https:// (which often jumps to Chrome).
 */

export function isNativeCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const C = (window as Window & { Capacitor?: Record<string, unknown> }).Capacitor;
    if (!C || typeof C !== "object") return false;
    const iso = (C as { isNativePlatform?: () => boolean }).isNativePlatform;
    if (typeof iso === "function" && iso()) return true;
    /* Before `isNativePlatform()` is ready, `getPlatform()` is still reliable in the shell WebView. */
    const gp = (C as { getPlatform?: () => string }).getPlatform;
    if (typeof gp === "function") {
      const p = gp();
      if (p === "android" || p === "ios") return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Build whatsapp:// URL (optional pre-filled text). */
export function buildWhatsAppAppUrl(command: string): string {
  const msgMatch = command.match(/\b(?:and|,)\s*say\s+(.+)$/i) || command.match(/\b(?:and|,)\s*send\s+(.+)$/i);
  const msg = msgMatch?.[1]?.trim();
  if (msg) return `whatsapp://send?text=${encodeURIComponent(msg)}`;
  return "whatsapp://send";
}

/** Build tg:// URL (optional pre-filled text). */
export function buildTelegramAppUrl(command: string): string {
  const msgMatch = command.match(/\b(?:and|,)\s*say\s+(.+)$/i) || command.match(/\b(?:and|,)\s*send\s+(.+)$/i);
  const msg = msgMatch?.[1]?.trim();
  if (msg) return `tg://msg?text=${encodeURIComponent(msg)}`;
  return "tg://";
}

/** Same shape as `NeoCommandRouter` on Android (`vnd.youtube:results?search_query=…`). */
export function buildYouTubeAppSearchUrl(query: string): string {
  const q = query.replace(/\s+/g, " ").trim() || "music";
  return `vnd.youtube:results?search_query=${encodeURIComponent(q)}`;
}

/**
 * Prefer opening outside the WebView. `_system` targets the system resolver on many Android WebViews.
 */
export function openNativeDeepLink(url: string): void {
  if (typeof window === "undefined") return;
  if (!url.trim()) return;

  if (!isNativeCapacitor()) {
    window.location.assign(url);
    return;
  }

  try {
    const w = window.open(url, "_system", "noopener,noreferrer");
    if (w) {
      try {
        w.opener = null;
      } catch {
        /* ignore */
      }
      return;
    }
  } catch {
    /* fall through */
  }

  try {
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("target", "_system");
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.location.assign(url);
  }
}
