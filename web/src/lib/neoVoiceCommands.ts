/**
 * Wake: **Neo** / **नियो** (or Hello Neo / हेलो नियो). Routing: WhatsApp / Telegram / tel:.
 * Example: "Neo open WhatsApp", Hindi wake + commands supported.
 */

import {
  buildWhatsAppWebUrl,
  mentionsWhatsApp,
  shouldOpenWhatsAppFromCommand,
} from "@/lib/whatsappOpenCommand";
import {
  buildTelegramWebUrl,
  mentionsTelegram,
  shouldOpenTelegramFromCommand,
} from "@/lib/telegramOpenCommand";
import {
  clearNeoFollowUpSession,
  isNeoFollowUpActive,
  startNeoFollowUpSession,
} from "@/lib/neoVoiceSession";

export type NeoAction =
  | { kind: "open_url"; url: string }
  | { kind: "tel"; href: string };

export type NeoCommandMode = "voice" | "text" | "voice-followup";

/**
 * Detect wake anywhere (earliest match). English: **Neo** alone or after hello/hi/hey.
 * Hindi: **नियो** alone or after greeting.
 */
export function extractHelloNeoCommand(raw: string): { hadWake: boolean; rest: string } {
  const t = raw.replace(/\s+/g, " ").trim();
  const patterns = [
    /\b(hello|hi|hey)[,!.']*\s+neo\b/i,
    /\b(hello|hi|hey)[,!.']*\s+new\b/i,
    /(नमस्ते|हेलो|हाय)[,!.']*\s+नियो/u,
    /\bneo\b/i,
    /\bनियो\b/u,
  ];

  let wake: { index: number; len: number } | null = null;
  for (const re of patterns) {
    const m = re.exec(t);
    if (!m) continue;
    if (!wake || m.index < wake.index || (m.index === wake.index && m[0].length > wake.len)) {
      wake = { index: m.index, len: m[0].length };
    }
  }

  if (!wake) return { hadWake: false, rest: t };

  const after = t.slice(wake.index + wake.len).replace(/^[,!.]?\s*/, "");
  return { hadWake: true, rest: after.trim() };
}

export function stripHelloNeoPrefix(raw: string): { hadWake: boolean; rest: string } {
  return extractHelloNeoCommand(raw);
}

export function extractTelHrefFromCommand(text: string): string | null {
  if (
    !/\b(call|dial|phone|ring|\u0915\u094C\u0932|\u092B\u094B\u0928)\b/i.test(text) &&
    !/\u0915\u094C\u0932\s*\u0915\u0930\u094B|\u092B\u094B\u0928\s*\u0932\u0917\u093E\u0913/i.test(text)
  ) {
    return null;
  }
  const m = text.match(/(\+\d[\d\s\-.]{8,}\d|\d{10,})/);
  if (!m) return null;
  let digits = m[1].replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11) return null;
  return `tel:+${digits}`;
}

/** Core intents on command text only (no wake). `silentReplies`: voice — no TTS when no action. */
export function runNeoIntents(q: string, silentReplies = false): { reply: string; actions: NeoAction[] } {
  const trimmed = q.trim();
  if (!trimmed) {
    return { reply: "", actions: [] };
  }

  const timeIntent =
    /\b(time|what(?:'s| is)?\s+the\s+time|current\s+time|time\s+now)\b/i.test(trimmed) ||
    /(समय|टाइम)\s*(क्या|बताओ|कितना|अभी)/i.test(trimmed);
  if (timeIntent) {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return { reply: `It's ${time}.`, actions: [] };
  }

  const ytMatch = trimmed.match(
    /\b(?:play|listen(?:\s+to)?|start)\b\s*(?:song|music)?\s*(?:on\s+youtube)?\s*(.+)?$/i,
  );
  const asksYoutube =
    /\b(youtube|you tube|song|music|singer)\b/i.test(trimmed) ||
    /(यूट्यूब|गाना|सॉन्ग|म्यूजिक|सिंगर)/i.test(trimmed);
  if (ytMatch || asksYoutube) {
    const candidate = (ytMatch?.[1] || trimmed)
      .replace(/\b(on|in)\s+youtube\b/gi, "")
      .replace(/\b(play|listen(?:\s+to)?|start|song|music)\b/gi, "")
      .trim();
    const query = candidate.length > 1 ? candidate : trimmed;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    return { reply: "Opening YouTube.", actions: [{ kind: "open_url", url }] };
  }

  const volumeIntent =
    /\b(volume|sound)\b/i.test(trimmed) || /(वॉल्यूम|आवाज़|आवाज)/i.test(trimmed);
  if (volumeIntent) {
    return {
      reply: silentReplies
        ? ""
        : "Volume control is available in the Android APK background listener.",
      actions: [],
    };
  }

  if (shouldOpenWhatsAppFromCommand(trimmed)) {
    const url = buildWhatsAppWebUrl(trimmed);
    return { reply: "Opening WhatsApp.", actions: [{ kind: "open_url", url }] };
  }

  if (shouldOpenTelegramFromCommand(trimmed)) {
    const url = buildTelegramWebUrl(trimmed);
    return { reply: "Opening Telegram.", actions: [{ kind: "open_url", url }] };
  }

  const telEarly = extractTelHrefFromCommand(trimmed);
  if (telEarly) {
    return { reply: "Calling that number.", actions: [{ kind: "tel", href: telEarly }] };
  }

  const msgIntent = /(read|check|see|inbox|message|chat|who\s*messaged|what\s*message|unread|missed)/i;
  const asksReadWa = msgIntent.test(trimmed) && mentionsWhatsApp(trimmed);
  const asksReadTg = msgIntent.test(trimmed) && mentionsTelegram(trimmed);

  const listenWhatsAppRead =
    /\blisten(?:ing)?\s+to\s+.*(message|chat|inbox).*whatsapp|whatsapp.*\blisten(?:ing)?\s+to\s+.*(message|chat)/i.test(
      trimmed,
    );

  if (
    asksReadWa ||
    /(read|check|see).*whatsapp|whatsapp.*(message|chat|inbox)|\u092E\u0948\u0938\u0947\u091C.*(\u092A\u0922\u093C|\u0926\u0947\u0916|\u0938\u0941\u0928)/i.test(
      trimmed,
    ) ||
    listenWhatsAppRead
  ) {
    return {
      reply: silentReplies
        ? ""
        : "I cannot read your WhatsApp inbox from this app — that needs the WhatsApp app on your phone, like Alexa cannot read a private app for you. Say Neo open WhatsApp to open WhatsApp Web.",
      actions: [],
    };
  }

  if (
    asksReadTg ||
    /(read|check|telegram).*message|telegram.*(chat|who)|\u0915\u093F\u0938\u0915\u093E\s*\u092E\u0948\u0938\u0947\u091C/i.test(
      trimmed,
    )
  ) {
    return {
      reply: silentReplies
        ? ""
        : "I cannot read your Telegram messages here — same limit as Alexa with another company's app. Say Neo open Telegram to open Telegram Web.",
      actions: [],
    };
  }

  if (/\bcall\s+[a-zA-Z\u0900-\u097F]{2,}\b/u.test(trimmed) && !/\d{5,}/.test(trimmed)) {
    return {
      reply: silentReplies
        ? ""
        : "I don't have that contact's number saved. Say the full number with country code.",
      actions: [],
    };
  }

  return {
    reply: silentReplies
      ? ""
      : "Say: open WhatsApp, open my Telegram channel, or call plus nine one and your number.",
    actions: [],
  };
}

export function processNeoCommandLine(
  input: string,
  mode: NeoCommandMode,
): { reply: string; actions: NeoAction[] } {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      reply: mode === "voice" || mode === "voice-followup" ? "" : "Say Neo, then your command.",
      actions: [],
    };
  }

  if (mode === "voice-followup") {
    return runNeoIntents(trimmed, true);
  }

  if (mode === "text") {
    const { hadWake, rest } = extractHelloNeoCommand(trimmed);
    const cmd = hadWake ? rest : trimmed;
    if (!cmd) {
      return {
        reply: 'Examples: "Neo, open WhatsApp" or "open Telegram".',
        actions: [],
      };
    }
    return runNeoIntents(cmd, false);
  }

  /* voice */
  if (isNeoFollowUpActive()) {
    const r = runNeoIntents(trimmed, true);
    if (r.actions.length > 0) clearNeoFollowUpSession();
    return r;
  }

  const { hadWake, rest } = extractHelloNeoCommand(trimmed);
  if (!hadWake) {
    return {
      reply: "",
      actions: [],
    };
  }

  if (!rest) {
    startNeoFollowUpSession(18000);
    return { reply: "", actions: [] };
  }

  const r = runNeoIntents(rest, true);
  if (r.actions.length > 0) clearNeoFollowUpSession();
  return r;
}

export function executeNeoActions(actions: NeoAction[]): void {
  const isNativeCapacitor = (): boolean => {
    if (typeof window === "undefined") return false;
    const c = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    try {
      return !!c?.isNativePlatform?.();
    } catch {
      return false;
    }
  };

  const openWithFallback = (primary: string, fallback: string) => {
    if (typeof window === "undefined") return;
    try {
      window.location.assign(primary);
    } catch {
      window.location.assign(fallback);
      return;
    }
    if (isNativeCapacitor()) return;
    window.setTimeout(() => {
      if (document.visibilityState !== "hidden") {
        window.location.assign(fallback);
      }
    }, 1200);
  };

  const toWhatsAppAppUrl = (webUrl: string): string => {
    const m = webUrl.match(/[?&]text=([^&]+)/i);
    if (m?.[1]) return `whatsapp://send?text=${m[1]}`;
    return "whatsapp://send";
  };

  const toTelegramAppUrl = (webUrl: string): string => {
    const m = webUrl.match(/[?&]text=([^&]+)/i);
    if (m?.[1]) return `tg://msg?text=${m[1]}`;
    return "tg://";
  };

  for (const a of actions) {
    if (a.kind === "open_url") {
      const u = a.url.toLowerCase();
      if (u.includes("web.whatsapp.com")) {
        openWithFallback(toWhatsAppAppUrl(a.url), a.url);
      } else if (u.includes("web.telegram.org") || u.includes("t.me/share")) {
        openWithFallback(toTelegramAppUrl(a.url), a.url);
      } else if (u.includes("youtube.com") || u.includes("youtu.be")) {
        openWithFallback(
          `vnd.youtube:${a.url.includes("search_query=") ? `results?search_query=${a.url.split("search_query=")[1]}` : ""}`,
          a.url,
        );
      } else {
        window.location.assign(a.url);
      }
    } else if (a.kind === "tel") {
      window.location.href = a.href;
    }
  }
}
