/**
 * **Neo voice commands — intent router (this file).**
 *
 * This repo does **not** use Python `SpeechRecognition`, Vosk, Kivy, or Pyjnius. Those are valid choices if you
 * build a standalone assistant in Python + Android JNI; here the stack is:
 *
 * - **Speech → text**: browser Web Speech API (`voiceChat.ts`), Capacitor/native one-shot capture where applicable,
 *   and the Voice page / Hello Neo UI (`HelloNeoVoiceStrip.tsx`, `voice/page.tsx`).
 * - **Text → actions**: this module matches wake phrases (`wakeWord.ts`) and routes intents (English + Hindi regex
 *   patterns) to `NeoAction[]` — open WhatsApp/Telegram (`whatsappOpenCommand.ts`, `telegramOpenCommand.ts`),
 *   `tel:` links, YouTube/music intents, etc. `executeNeoActions()` performs `window.open`, `location`, or native
 *   deep links (`nativeAppLinks.ts`).
 * - **Spoken feedback**: callers pass `silentReplies` for voice; short `reply` strings are spoken via browser TTS or
 *   OpenAI TTS (`voiceAvatarTts.ts`). After **Hello Neo** with no tail, a short command window opens (`neoVoiceSession`);
 *   then the user should say **Hello Neo** again for the next cycle (see Hello Neo strip + native wake service delays).
 *
 * Wake: **Neo** / **नियो** (or Hello Neo / हेलो नियो). Example: “Neo, open WhatsApp”.
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
import type { VoiceSpeechLangCode } from "@/lib/voiceLanguages";
import { DEFAULT_VOICE_SPEECH_LANG, neoWakeAckPhrase } from "@/lib/voiceLanguages";
import {
  clearNeoFollowUpSession,
  isNeoFollowUpActive,
  startNeoFollowUpSession,
} from "@/lib/neoVoiceSession";
import {
  buildTelegramAppUrl as buildTgAppUrl,
  buildWhatsAppAppUrl,
  buildYouTubeAppSearchUrl,
  isNativeCapacitor,
  openNativeDeepLink,
} from "@/lib/nativeAppLinks";

export type NeoAction =
  | { kind: "open_url"; url: string }
  | { kind: "tel"; href: string };

export type NeoCommandMode = "voice" | "text" | "voice-followup";

export type NeoProcessOptions = {
  /** Used for wake-only TTS (e.g. "Yes, I heard you"). */
  speechLang?: VoiceSpeechLangCode;
};

/** True when user text is mostly Hindi script — Shuddh Hindi command replies apply. */
export function queryLooksHindi(q: string): boolean {
  const t = q.trim();
  if (!t) return false;
  const deva = (t.match(/[\u0900-\u097F]/g) ?? []).length;
  return deva >= 4 || deva / Math.max(t.length, 1) >= 0.06;
}

/** Product copy is English-only in the app UI; spoken command feedback uses the same. */
function cmdReply(en: string, _hi: string, _q: string, _speechLang?: VoiceSpeechLangCode): string {
  return en;
}

/** After a “busy” line, skip repeating a generic “Opening …” TTS. */
export function isShortOpenActionReply(reply: string): boolean {
  const t = reply.trim();
  if (/^Opening (music|contacts|YouTube|WhatsApp|Telegram)\.?$/i.test(t)) return true;
  return (
    /^व्हाट्सऐप खोल रहे हैं/u.test(t) ||
    /^टेलीग्राम खोल रहे हैं/u.test(t) ||
    /^यूट्यूब खोल रहे हैं/u.test(t) ||
    /^संगीत ऐप खोल रहे हैं/u.test(t) ||
    /^संपर्क सूची खोल रहे हैं/u.test(t)
  );
}

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
export function runNeoIntents(
  q: string,
  silentReplies = false,
  speechLang?: VoiceSpeechLangCode,
): { reply: string; actions: NeoAction[] } {
  const trimmed = q.trim();
  if (!trimmed) {
    return { reply: "", actions: [] };
  }

  const openAppOnly =
    /\b(open|launch|start|show|खोल|खोलो)\b/i.test(trimmed) &&
    /\b(whatsapp|telegram|youtube|music|contact|contacts)\b/i.test(trimmed);
  const wantsReadInbox =
    (
      /\b(read|padho|पढ़|dikhao|दिखा|whose|what\s+did|kya\s+bola|क्या\s+बोल|kis\s*ka|किस\s*का|kaun\s*sa|कौन\s*सा|last\s+message)\b/i.test(
        trimmed,
      ) ||
      /\b(check)\b.*\b(message|messages|sms|मैसेज|notification|notif)\b/i.test(trimmed) ||
      /\b(message|messages|sms|मैसेज)\b.*\b(check)\b/i.test(trimmed)
    ) &&
    /\b(message|messages|sms|मैसेज|chat|whatsapp|telegram|व्हाट्स|टेली)\b/i.test(trimmed);
  if (wantsReadInbox && !openAppOnly) {
    return {
      reply: silentReplies
        ? ""
        : cmdReply(
            "I can't read full WhatsApp or Telegram message text from here for privacy. Say Neo, open WhatsApp — then read inside the app.",
            "निजता के कारण यहाँ से व्हाट्सऐप या टेलीग्राम के भीतर के संदेश पूरी तरह नहीं पढ़े जा सकते। पहले नियो कहकर ऐप खुलवा लें, फिर ऐप में देखें।",
            trimmed,
            speechLang,
          ),
      actions: [],
    };
  }

  const timeIntent =
    /\b(time|what(?:'s| is)?\s+the\s+time|current\s+time|time\s+now)\b/i.test(trimmed) ||
    /(समय|टाइम)\s*(क्या|बताओ|कितना|अभी)/i.test(trimmed);
  if (timeIntent) {
    const now = new Date();
    const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return {
      reply: `It's ${time}.`,
      actions: [],
    };
  }

  const wantsMusicApp =
    /\b(open|play|launch|start)\b.*\bmusic\b|\bmusic\b.*\b(open|play|launch|start)\b/i.test(trimmed) ||
    /\bopen\s+my\s+music\b/i.test(trimmed);
  if (isNativeCapacitor() && wantsMusicApp) {
    const url = "intent://#Intent;package=com.google.android.apps.youtube.music;end";
    return {
      reply: cmdReply("Opening music.", "संगीत ऐप खोल रहे हैं।", trimmed, speechLang),
      actions: [{ kind: "open_url", url }],
    };
  }

  const contactsOpen =
    /\b(open|launch|show|start)\b.*\b(contact|contacts|phonebook|phone book|address book)\b/i.test(trimmed) ||
    /\b(contact|contacts|phonebook|phone book)\b.*\b(open|launch|show|start)\b/i.test(trimmed) ||
    /\b(my\s+contact|mycontact|my\s+contacts)\b/i.test(trimmed) ||
    /(संपर्क|फोन\s*बुक).*(\bखोल|open|launch)/i.test(trimmed) ||
    /\b(खोल|open)\b.*(संपर्क|फोन\s*बुक)/i.test(trimmed);
  if (isNativeCapacitor() && contactsOpen) {
    return {
      reply: cmdReply("Opening contacts.", "संपर्क सूची खोल रहे हैं।", trimmed, speechLang),
      actions: [{ kind: "open_url", url: "content://com.android.contacts/contacts" }],
    };
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
    const url = isNativeCapacitor()
      ? buildYouTubeAppSearchUrl(query)
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    return {
      reply: cmdReply("Opening YouTube.", "यूट्यूब खोल रहे हैं।", trimmed, speechLang),
      actions: [{ kind: "open_url", url }],
    };
  }

  const volumeIntent =
    /\b(volume|sound)\b/i.test(trimmed) || /(वॉल्यूम|आवाज़|आवाज)/i.test(trimmed);
  if (volumeIntent) {
    return {
      reply: silentReplies
        ? ""
        : cmdReply(
            "Volume control is available in the Android APK background listener.",
            "आवाज़ कम-ज़्यादा एपीके की पृष्ठभूमि सुनने वाली सुविधा में मिलेगी।",
            trimmed,
            speechLang,
          ),
      actions: [],
    };
  }

  if (shouldOpenWhatsAppFromCommand(trimmed)) {
    const url = isNativeCapacitor() ? buildWhatsAppAppUrl(trimmed) : buildWhatsAppWebUrl(trimmed);
    return {
      reply: cmdReply("Opening WhatsApp.", "व्हाट्सऐप खोल रहे हैं।", trimmed, speechLang),
      actions: [{ kind: "open_url", url }],
    };
  }

  if (shouldOpenTelegramFromCommand(trimmed)) {
    const url = isNativeCapacitor() ? buildTgAppUrl(trimmed) : buildTelegramWebUrl(trimmed);
    return {
      reply: cmdReply("Opening Telegram.", "टेलीग्राम खोल रहे हैं।", trimmed, speechLang),
      actions: [{ kind: "open_url", url }],
    };
  }

  const telEarly = extractTelHrefFromCommand(trimmed);
  if (telEarly) {
    return {
      reply: cmdReply("Calling that number.", "उस नंबर पर कॉल लगा रहे हैं।", trimmed, speechLang),
      actions: [{ kind: "tel", href: telEarly }],
    };
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
      reply: cmdReply(
        "I cannot read your WhatsApp inbox from this app — that needs the WhatsApp app on your phone, like Alexa cannot read a private app for you. Say Neo open WhatsApp to open WhatsApp Web.",
        "यह ऐप आपके व्हाट्सऐप का आंतरिक संदेश नहीं पढ़ सकता — वह फ़ोन पर व्हाट्सऐप में ही देखें। नियो कहकर व्हाट्सऐप वेब खुलवा सकते हैं।",
        trimmed,
        speechLang,
      ),
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
      reply: cmdReply(
        "I cannot read your Telegram messages here — same limit as Alexa with another company's app. Say Neo open Telegram to open Telegram Web.",
        "टेलीग्राम के भीतर के संदेश यहाँ नहीं पढ़े जा सकते। नियो कहकर टेलीग्राम वेब खुलवा सकते हैं।",
        trimmed,
        speechLang,
      ),
      actions: [],
    };
  }

  if (/\bcall\s+[a-zA-Z\u0900-\u097F]{2,}\b/u.test(trimmed) && !/\d{5,}/.test(trimmed)) {
    return {
      reply: silentReplies
        ? ""
        : cmdReply(
            "I don't have that contact's number saved. Say the full number with country code.",
            "उस संपर्क का नंबर यहाँ सेव नहीं मिला। देश कोड सहित पूरा नंबर बोलिए।",
            trimmed,
            speechLang,
          ),
      actions: [],
    };
  }

  return {
    reply: silentReplies
      ? ""
      : cmdReply(
          "Say: open WhatsApp, open my Telegram channel, or call plus nine one and your number.",
          "कहिए—व्हाट्सऐप खोलो, टेलीग्राम खोलो, या नौ एक और फिर अपना नंबर बोलकर कॉल लगाओ।",
          trimmed,
          speechLang,
        ),
    actions: [],
  };
}

export function processNeoCommandLine(
  input: string,
  mode: NeoCommandMode,
  options?: NeoProcessOptions,
): { reply: string; actions: NeoAction[] } {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      reply:
        mode === "voice" || mode === "voice-followup"
          ? ""
          : cmdReply("Say Neo, then your command.", "पहले «नियो» कहिए, फिर अपनी आज्ञा।", "", options?.speechLang),
      actions: [],
    };
  }

  if (mode === "voice-followup") {
    return runNeoIntents(trimmed, true, options?.speechLang);
  }

  if (mode === "text") {
    const { hadWake, rest } = extractHelloNeoCommand(trimmed);
    const cmd = hadWake ? rest : trimmed;
    if (!cmd) {
      return {
        reply: cmdReply(
          'Examples: "Neo, open WhatsApp" or "open Telegram".',
          "उदाहरण—«नियो, व्हाट्सऐप खोलो» या «टेलीग्राम खोलो»।",
          trimmed,
          options?.speechLang,
        ),
        actions: [],
      };
    }
    return runNeoIntents(cmd, false, options?.speechLang);
  }

  /* voice */
  if (isNeoFollowUpActive()) {
    const r = runNeoIntents(trimmed, true, options?.speechLang);
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
    startNeoFollowUpSession();
    const lang = options?.speechLang ?? DEFAULT_VOICE_SPEECH_LANG;
    return { reply: neoWakeAckPhrase(lang), actions: [] };
  }

  const r = runNeoIntents(rest, true, options?.speechLang);
  if (r.actions.length > 0) clearNeoFollowUpSession();
  return r;
}

export function executeNeoActions(actions: NeoAction[]): void {
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
      if (isNativeCapacitor()) {
        openNativeDeepLink(a.url);
        continue;
      }
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
      if (isNativeCapacitor()) {
        openNativeDeepLink(a.href);
      } else {
        window.location.href = a.href;
      }
    }
  }
}
