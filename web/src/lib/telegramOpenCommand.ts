/**
 * Open Telegram Web / share links — mirrors WhatsApp-style commands.
 */

export const TELEGRAM_WEB_URL = "https://web.telegram.org/a/";

export function mentionsTelegram(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\btelegram\b/.test(lower)) return true;
  return /टेलीग्राम|टेली ग्राम|टेलिग्राम/i.test(text);
}

function negated(text: string): boolean {
  return /\b(don't|do not|never)\s+(open|launch)|मत\s+खोलो|टेलीग्राम\s+मत/i.test(text);
}

export function shouldOpenTelegramFromCommand(text: string): boolean {
  const s = text.trim();
  if (!s || !mentionsTelegram(s) || negated(s)) return false;
  const lower = s.toLowerCase();
  if (
    /\b(open|launch|start|show)\s+telegram\b/i.test(lower) ||
    /\b(open|launch|start|show|go\s+to)\s+my\s+telegram\b/i.test(lower) ||
    /\btelegram\s+(open|launch|start)(\s+please|\s+now)?\b/i.test(lower) ||
    /\bgo\s+to\s+telegram\b/i.test(lower) ||
    /\btelegram\b.*\bchannel\b|\bchannel\b.*\btelegram\b|\bmy\s+telegram\b/i.test(lower) ||
    /\bmy\s+telegram\s+(open|launch|start|please|now)\b/i.test(lower)
  ) {
    return true;
  }

  if (!negated(s)) {
    if (/^\s*my\s+telegram\s*[.!,]?\s*$/i.test(s)) return true;
    if (/^\s*(please\s+)?(open|show)\s+my\s+telegram\s*[.!,]?\s*$/i.test(s)) return true;
  }
  if (/टेलीग्राम\s*खोलो|खोलो\s*टेलीग्राम|टेलीग्राम\s*ओपन|ओपन\s*टेलीग्राम/i.test(s)) {
    return true;
  }
  return false;
}

export function extractTelegramPrefillMessage(command: string): string | null {
  const s = command.trim();
  let m = s.match(/\b(?:and|,)\s*say\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  m = s.match(/\b(?:and|,)\s*send\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  m = s.match(/और\s+(.+?)\s+भेजो\s*$/i);
  if (m?.[1]) return m[1].trim();
  return null;
}

export function buildTelegramWebUrl(command: string): string {
  if (!shouldOpenTelegramFromCommand(command)) return TELEGRAM_WEB_URL;
  const msg = extractTelegramPrefillMessage(command);
  if (msg && msg.length > 0) {
    return `https://t.me/share/url?text=${encodeURIComponent(msg)}`;
  }
  return TELEGRAM_WEB_URL;
}
