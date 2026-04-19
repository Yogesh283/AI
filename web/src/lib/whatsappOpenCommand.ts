/**
 * Detect "open WhatsApp" style commands and open https://web.whatsapp.com in a new tab.
 */

import type { VoiceSpeechLangCode } from "@/lib/voiceLanguages";

export const WHATSAPP_WEB_URL = "https://web.whatsapp.com/";

export function mentionsWhatsApp(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\bwhatsapp\b/.test(lower)) return true;
  return /व्हाट्सएप|व्हाट्सप|व्हाटसप|वाट्सऐप|व्हाट्सऐप/i.test(text);
}

function isNegatedOpenIntent(text: string): boolean {
  return (
    /\b(don't|do not|never)\s+(open|launch)|\bnot\s+open\b|मत\s+खोलो|न\s+खोलो|नहीं\s+खोलो|मत\s+ओपन|व्हाट्सएप\s+मत/i.test(
      text,
    )
  );
}

/** True when the user clearly asks to open WhatsApp (voice or typed). */
export function shouldOpenWhatsAppFromCommand(text: string): boolean {
  const s = text.trim();
  if (!s || !mentionsWhatsApp(s)) return false;
  if (isNegatedOpenIntent(s)) return false;

  const lower = s.toLowerCase();
  if (
    /\b(open|launch|start|show)\s+whatsapp\b/i.test(lower) ||
    /\b(open|launch|start|show|go\s+to)\s+my\s+whatsapp\b/i.test(lower) ||
    /\bwhatsapp\s+(open|launch)\b/i.test(lower) ||
    /\bgo\s+to\s+whatsapp\b/i.test(lower) ||
    /^open\s+wa\b/i.test(lower)
  ) {
    return true;
  }

  if (!isNegatedOpenIntent(s)) {
    if (/^\s*my\s+whatsapp\s*[.!,]?\s*$/i.test(s)) return true;
    if (/^\s*(please\s+)?(open|show)\s+my\s+whatsapp\s*[.!,]?\s*$/i.test(s)) return true;
    if (/\bmy\s+whatsapp\s+(open|launch|start|please|now)\b/i.test(lower)) return true;
    if (/\bwhatsapp\s+(open|launch|start)(\s+please|\s+now)?\b/i.test(lower)) return true;
  }

  // Hindi / Hinglish voice (e.g. "मेरा व्हाट्सएप ओपन करो", "व्हाट्सएप खोल दो")
  if (
    /व्हाट्सएप\s*ओपन|ओपन\s*व्हाट्सएप|वाट्सऐप\s*ओपन|ओपन\s*वाट्सऐप/i.test(s) ||
    /मेरा\s+व्हाट्सएप\s*ओपन|मेरा\s+वाट्सएप\s*खोल|मेरा\s+वाट्सएप.*ओपन\s*करो/i.test(s) ||
    /व्हाट्सएप\s*ओपन\s*करो|वाट्सऐप\s*ओपन\s*करो|व्हाट्सएप\s*ओपन\s*करें|व्हाट्सएप\s*खोल\s*दो|व्हाट्सएप\s*खोल\s*दीजिए/i.test(
      s,
    ) ||
    /व्हाट्सएप\s*खोलो|खोलो\s*व्हाट्सएप|वाट्सऐप\s*खोलो|खोलो\s*वाट्सऐप/i.test(s)
  ) {
    return true;
  }

  return false;
}

/**
 * Optional message to prefill on WhatsApp Web (`/send?text=`).
 * Examples: "open whatsapp and say hello", "open whatsapp, send hi there"
 */
export function extractWhatsAppPrefillMessage(command: string): string | null {
  const s = command.trim();
  let m = s.match(/\b(?:and|,)\s*say\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  m = s.match(/\b(?:and|,)\s*send\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  m = s.match(/\bwith\s+message\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  m = s.match(/और\s+(.+?)\s+भेजो\s*$/i);
  if (m?.[1]) return m[1].trim();
  m = s.match(/और\s+(.+?)\s+लिखो\s*$/i);
  if (m?.[1]) return m[1].trim();
  return null;
}

/** Full URL: home or compose with prefilled text. */
export function buildWhatsAppWebUrl(command: string): string {
  if (!shouldOpenWhatsAppFromCommand(command)) return WHATSAPP_WEB_URL;
  const msg = extractWhatsAppPrefillMessage(command);
  if (msg && msg.length > 0) {
    return `https://web.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  }
  return WHATSAPP_WEB_URL;
}

/**
 * Try opening WhatsApp Web in a new tab. Often returns `false` after voice (async) —
 * browsers treat that as not a direct tap, and block popups.
 */
export function tryOpenWhatsAppPopup(url: string = WHATSAPP_WEB_URL): boolean {
  if (typeof window === "undefined") return false;
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) return false;
  try {
    w.opener = null;
  } catch {
    /* ignore */
  }
  return true;
}

/** Same-tab fallback when `tryOpenWhatsAppPopup()` is false. */
export function navigateToWhatsAppWeb(url: string = WHATSAPP_WEB_URL): void {
  if (typeof window === "undefined") return;
  window.location.assign(url);
}

/** @deprecated Use tryOpenWhatsAppPopup + navigateToWhatsAppWeb */
export function openWhatsAppInNewTab(): boolean {
  return tryOpenWhatsAppPopup();
}

export function whatsAppOpenAck(lang: VoiceSpeechLangCode, mode: "new-tab" | "same-tab"): string {
  void lang;
  return mode === "new-tab"
    ? "Opening WhatsApp in a new tab."
    : "Opening WhatsApp here — a new tab was blocked. Use Back to return to the app.";
}
