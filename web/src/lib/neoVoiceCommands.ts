/**
 * **Neo voice commands — integrated pipeline (this file is the “command processor” + action contract).**
 *
 * End-to-end layers (voice shortcut path only — not full free-form chat):
 *
 * 1. **Voice recognition** → text: Web Speech API (`voiceChat.ts`), Hello Neo / Voice UI (`HelloNeoVoiceStrip.tsx`,
 *    `voice/page.tsx`); APK uses native / Capacitor capture where needed.
 * 2. **Command processor** → structured intent: `extractHelloNeoCommand`, `processNeoCommandLine`, `runNeoIntents`
 *    (this file + `whatsappOpenCommand.ts`, `telegramOpenCommand.ts`, etc.).
 * 3. **“API” / app integration** → side effects: `executeNeoActions` (browser `https` / `tel:`) and
 *    `NeoNativeRouter` + Android intents on Capacitor — not vendor private APIs (no WhatsApp inbox read).
 * 4. **Natural reply (short)** → template / TTS: `cmdReply` strings here; `speakText` / `tryPlayOpenAiTtsPlain`
 *    (`voiceChat.ts`, `voiceAvatarTts.ts`). Optional LLM line only when `HelloNeoVoiceStrip` calls `postChat` for
 *    unmatched voice help — still gated to signed-in web, not native shortcut spam.
 * 5. **Event / orchestration** → order & state: `HelloNeoVoiceStrip` `runPipeline` (wake, follow-up `neoVoiceSession.ts`),
 *    mic lifecycle, `executeNeoActions` after speak; APK foreground wake + `NeoCommandRouter.java` for parallel path.
 *
 * **Cross-platform parity:** `runNeoIntents` / `processNeoCommandLine` are shared for dashboard **typed** `text` and
 * **voice**; only step (1) and deep links in (3) differ by device.
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
  /** Profile display name for personalized wake / greeting copy. */
  displayName?: string | null;
};

type PendingConfirmation = {
  actions: NeoAction[];
  expiresAt: number;
  speechLang?: VoiceSpeechLangCode;
};

const CONFIRM_TTL_MS = 20_000;
let pendingConfirmation: PendingConfirmation | null = null;

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

function hasActivePendingConfirmation(): boolean {
  if (!pendingConfirmation) return false;
  if (Date.now() > pendingConfirmation.expiresAt) {
    pendingConfirmation = null;
    return false;
  }
  return true;
}

function isConfirmYes(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(yes|yep|yeah|ok|okay|confirm|do it|haan|ha|han|h|theek hai|thik hai|करो|हाँ|हां)$/i.test(t);
}

function isConfirmNo(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(no|nope|cancel|stop|mat|nahi|nahin|ना|नहीं|रद्द|cancel it)$/i.test(t);
}

/** Browser-only: common sites + search fallback (APK uses installed apps via native router). */
const WEB_QUICK_NAV: Record<string, string> = {
  google: "https://www.google.com/",
  chrome: "https://www.google.com/chrome/",
  "google chrome": "https://www.google.com/chrome/",
  gmail: "https://mail.google.com/mail/",
  mail: "https://mail.google.com/mail/",
  inbox: "https://mail.google.com/mail/",
  maps: "https://maps.google.com/",
  map: "https://maps.google.com/",
  "google maps": "https://maps.google.com/",
  youtube: "https://www.youtube.com/",
  facebook: "https://www.facebook.com/",
  fb: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  ig: "https://www.instagram.com/",
  twitter: "https://twitter.com/",
  x: "https://x.com/",
  linkedin: "https://www.linkedin.com/",
  amazon: "https://www.amazon.in/",
  flipkart: "https://www.flipkart.com/",
  drive: "https://drive.google.com/",
  "google drive": "https://drive.google.com/",
  calendar: "https://calendar.google.com/",
  photos: "https://photos.google.com/",
  translate: "https://translate.google.com/",
  news: "https://news.google.com/",
  weather: "https://www.google.com/search?q=weather",
  netflix: "https://www.netflix.com/",
  spotify: "https://open.spotify.com/",
  github: "https://github.com/",
  reddit: "https://www.reddit.com/",
  paytm: "https://paytm.com/",
  phonepe: "https://www.phonepe.com/",
  "google pay": "https://pay.google.com/",
  gpay: "https://pay.google.com/",
  playstore: "https://play.google.com/store",
  "play store": "https://play.google.com/store",
  zoom: "https://zoom.us/",
  teams: "https://teams.microsoft.com/",
  outlook: "https://outlook.live.com/",
  hotmail: "https://outlook.live.com/",
  bing: "https://www.bing.com/",
  duckduckgo: "https://duckduckgo.com/",
};

const HI_SITE_TOKEN: Record<string, string> = {
  गूगल: "google",
  जीमेल: "gmail",
  यूट्यूब: "youtube",
  फेसबुक: "facebook",
  इंस्टाग्राम: "instagram",
  मैप: "maps",
  मैप्स: "maps",
};

function normalizeWebOpenTarget(raw: string): string {
  return raw
    .replace(/[.!?,]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(the|my|a|an)\s+/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Web: “open Gmail”, “open Google”, Hindi “गूगल खोलो”, or unknown “open Xyz” → best URL or Google search.
 * APK: not used (native opens real apps).
 */
export function tryFlexibleWebOpen(
  trimmed: string,
  speechLang?: VoiceSpeechLangCode,
): { reply: string; actions: NeoAction[] } | null {
  if (isNativeCapacitor()) return null;
  const t = trimmed.trim();
  if (t.length < 3) return null;

  const searchM = t.match(
    /^(?:neo\s+)?\b(search|google|look\s*up|find)\s+(?:the\s+web\s+for\s+|for\s+|the\s+)?(.+)/i,
  );
  if (searchM && searchM[2]?.trim().length > 1) {
    const q = searchM[2].trim().slice(0, 200);
    return {
      reply: cmdReply("Opening a search for that in a new tab.", "नए टैब में सर्च खोल रहे हैं।", t, speechLang),
      actions: [{ kind: "open_url", url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}` }],
    };
  }

  let target: string | null = null;
  const enOpen = t.match(
    /\b(?:open|launch|visit|go\s*to|goto|show|start|take\s+me\s+to)\s+(?:the\s+|my\s+|a\s+)?(.+)$/i,
  );
  if (enOpen?.[1]) target = normalizeWebOpenTarget(enOpen[1]);

  if (!target || target.length < 2) {
    const hi = t.match(
      /^(?:नियो\s+)?(गूगल|जीमेल|यूट्यूब|फेसबुक|इंस्टाग्राम|मैप्स|मैप)\s*(?:खोलो|खोल|ओपन)/u,
    );
    if (hi?.[1]) {
      const key = HI_SITE_TOKEN[hi[1]];
      if (key) target = key;
    }
  }

  if (!target || target.length < 2) return null;

  let url = WEB_QUICK_NAV[target];
  if (!url) url = WEB_QUICK_NAV[target.split(/\s+/)[0] ?? ""];
  if (!url) {
    url = `https://www.google.com/search?q=${encodeURIComponent(`open ${target}`)}`;
  }
  const pretty = target.slice(0, 32);
  return {
    reply: cmdReply(
      `Alright — opening ${pretty} in a new browser tab for you.`,
      `ठीक है — ${pretty} नए ब्राउज़र टैब में खोल रहे हैं।`,
      t,
      speechLang,
    ),
    actions: [{ kind: "open_url", url }],
  };
}

function looksIllegalOrUnsafeCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  const illegalPatterns = [
    /\b(hack|hacking|phish|phishing|scam|fraud|spoof|ddos|malware|virus|ransomware)\b/i,
    /\b(bomb|explosive|gun|weapon|drugs?|narcotic|counterfeit|fake id|forgery)\b/i,
    /\b(stalk|spy|blackmail|harass|threat|extort)\b/i,
    /(हैक|फिशिंग|स्कैम|धोखा|फ्रॉड|बम|हथियार|नशा|जाली|ब्लैकमेल|धमकी)/i,
  ];
  return illegalPatterns.some((re) => re.test(t));
}

function needsActionConfirmation(input: string, actions: NeoAction[]): boolean {
  if (actions.length === 0) return false;
  const t = input.toLowerCase();
  const hasCall = actions.some((a) => a.kind === "tel");
  if (hasCall) return true;
  const hasMessageIntent =
    /\b(send|message|reply|text)\b/i.test(t) || /(भेजो|मैसेज|संदेश|reply|रिप्लाई)/i.test(input);
  const opensMessenger = actions.some(
    (a) =>
      a.kind === "open_url" &&
      (a.url.toLowerCase().includes("whatsapp") || a.url.toLowerCase().includes("telegram")),
  );
  return hasMessageIntent && opensMessenger;
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
  const t = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
  const patterns = [
    /\b(hello|hi|hey|hallo|helo|hullo|hola)[,!.']*\s+neo\b/i,
    /\b(hello|hi|hey|hallo|helo|hullo|hola)[,!.']*\s+new\b/i,
    /\bnamaste[,!.']*\s+neo\b/i,
    /(नमस्ते|हेलो|हाय|हैलो|हॅलो)[,!.']*\s*नियो/u,
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

/**
 * APK lock-screen / off-screen Live: **only** explicit greeting + Neo unlocks assistant audio — not bare “Neo” in a sentence.
 * (General command parsing still uses {@link extractHelloNeoCommand}, which also matches standalone “neo”.)
 */
export function isStrictHelloNeoWakePhrase(raw: string): boolean {
  const t = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
  if (!t) return false;
  const strictOnly = [
    /\b(hello|hi|hey|hallo|helo|hullo|hola)[,!.']*\s+neo\b/i,
    /\b(hello|hi|hey|hallo|helo|hullo|hola)[,!.']*\s+new\b/i,
    /\bnamaste[,!.']*\s+neo\b/i,
    /(नमस्ते|हेलो|हाय|हैलो|हॅलो)[,!.']*\s*नियो/u,
  ];
  return strictOnly.some((re) => re.test(t));
}

export function stripHelloNeoPrefix(raw: string): { hadWake: boolean; rest: string } {
  return extractHelloNeoCommand(raw);
}

/** Mic is UI-only; swallow these phrases with no reply/TTS so they are not mistaken for other intents. */
export function isMicControlCommand(q: string): boolean {
  const trimmed = q.replace(/\s+/g, " ").trim();
  if (!trimmed) return false;
  const t = trimmed.toLowerCase();
  return (
    /\b(mic|microphone)\b.*\b(on|off|start|stop|mute|unmute)\b/i.test(t) ||
    /\b(on|off|start|stop|mute|unmute)\b.*\b(mic|microphone)\b/i.test(t) ||
    /(माइक|माइक्रोफोन).*(चालू|बंद|ऑन|ऑफ|शुरू|रोक|म्यूट|अनम्यूट)/i.test(trimmed)
  );
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

/** Core intents on command text only (no wake). `silentReplies`: voice mode (templates still spoken where helpful). */
export function runNeoIntents(
  q: string,
  silentReplies = false,
  speechLang?: VoiceSpeechLangCode,
): { reply: string; actions: NeoAction[] } {
  const trimmed = q.trim();
  if (!trimmed) {
    return { reply: "", actions: [] };
  }

  if (isMicControlCommand(trimmed)) {
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
      reply: cmdReply(
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
  if (wantsMusicApp) {
    if (isNativeCapacitor()) {
      const url = "intent://#Intent;package=com.google.android.apps.youtube.music;end";
      return {
        reply: cmdReply("Opening music.", "संगीत ऐप खोल रहे हैं।", trimmed, speechLang),
        actions: [{ kind: "open_url", url }],
      };
    }
    return {
      reply: cmdReply("Opening YouTube Music in your browser.", "ब्राउज़र में YouTube Music खोल रहे हैं।", trimmed, speechLang),
      actions: [{ kind: "open_url", url: "https://music.youtube.com/" }],
    };
  }

  const contactsOpen =
    /\b(open|launch|show|start)\b.*\b(contact|contacts|phonebook|phone book|address book)\b/i.test(trimmed) ||
    /\b(contact|contacts|phonebook|phone book)\b.*\b(open|launch|show|start)\b/i.test(trimmed) ||
    /\b(my\s+contact|mycontact|my\s+contacts)\b/i.test(trimmed) ||
    /\b(contact|contacts)\s*(list|लिस्ट)\b/i.test(trimmed) ||
    /(कॉन्टैक्ट|कांटेक्ट|संपर्क).*(लिस्ट|list|सूची)/i.test(trimmed) ||
    /(लिस्ट|list|सूची).*(कॉन्टैक्ट|कांटेक्ट|संपर्क)/i.test(trimmed) ||
    /मेरी\s+(कॉन्टैक्ट|कांटेक्ट|संपर्क)/i.test(trimmed) ||
    /(संपर्क|फोन\s*बुक).*(\bखोल|open|launch)/i.test(trimmed) ||
    /\b(खोल|open)\b.*(संपर्क|फोन\s*बुक)/i.test(trimmed);
  if (contactsOpen) {
    if (isNativeCapacitor()) {
      return {
        reply: cmdReply("Opening contacts.", "संपर्क सूची खोल रहे हैं।", trimmed, speechLang),
        actions: [{ kind: "open_url", url: "content://com.android.contacts/contacts" }],
      };
    }
    return {
      reply: cmdReply("Opening Google Contacts in your browser.", "ब्राउज़र में Google Contacts खोल रहे हैं।", trimmed, speechLang),
      actions: [{ kind: "open_url", url: "https://contacts.google.com/" }],
    };
  }

  const openProfileOrAccount =
    !/\b(whatsapp|telegram|facebook|instagram)\s+(profile|account)\b/i.test(trimmed) &&
    (/\b(my\s+)?(profile|account)\b/i.test(trimmed) ||
      /\baccount\s+settings\b/i.test(trimmed) ||
      /\bneo\s+profile\b/i.test(trimmed) ||
      /(प्रोफाइल|प्रोफ़ाइल|अकाउंट|खाता)/i.test(trimmed)) &&
    (/\b(open|show|launch|start|go to|visit|take me|can you|could you|please)\b/i.test(trimmed) ||
      /\b(open|show)\s+my\s+account\b/i.test(trimmed) ||
      /(खोल|ओपन|दिखा)/i.test(trimmed));
  if (openProfileOrAccount) {
    if (isNativeCapacitor()) {
      return {
        reply: cmdReply("Opening your profile.", "प्रोफाइल खोल रहे हैं।", trimmed, speechLang),
        actions: [{ kind: "open_url", url: "neo-app:/profile" }],
      };
    }
    return {
      reply: cmdReply("Opening profile.", "प्रोफाइल खोल रहे हैं।", trimmed, speechLang),
      actions: [{ kind: "open_url", url: "/profile" }],
    };
  }

  const ytMatch = trimmed.match(
    /\b(?:play|listen(?:\s+to)?|start)\b\s*(?:song|music)?\s*(?:on\s+youtube)?\s*(.+)?$/i,
  );
  const asksYoutube =
    /\b(youtube|you tube|song|music|singer)\b/i.test(trimmed) ||
    /(यूट्यूब|गाना|गाने|संगीत|सॉन्ग|म्यूजिक|सिंगर)/i.test(trimmed);
  if (ytMatch || asksYoutube) {
    const candidate = (ytMatch?.[1] || trimmed)
      .replace(/\b(on|in)\s+youtube\b/gi, "")
      .replace(/\b(play|listen(?:\s+to)?|start|song|music)\b/gi, "")
      .replace(
        /यूट्यूब|गाना|गाने|संगीत|सॉन्ग|म्यूजिक|सिंगर|चलाओ|चला दो|बजाओ|सुनाओ|सुना दो|खोलो|खोल/gu,
        " ",
      )
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
      reply: cmdReply(
        isNativeCapacitor()
          ? "Volume control is available in the Android APK background listener."
          : "Volume is controlled by your device or browser — use the volume keys or system mixer.",
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
      reply: cmdReply(
        "I don't have that contact's number saved. Say the full number with country code.",
        "उस संपर्क का नंबर यहाँ सेव नहीं मिला। देश कोड सहित पूरा नंबर बोलिए।",
        trimmed,
        speechLang,
      ),
      actions: [],
    };
  }

  const flexWeb = tryFlexibleWebOpen(trimmed, speechLang);
  if (flexWeb) return flexWeb;

  return {
    reply: cmdReply(
      silentReplies
        ? "I didn't match that to a command. Try: open WhatsApp, open YouTube, what's the time, or open Gmail."
        : "Try something like: open WhatsApp, open Telegram, or call plus nine one and your number.",
      "जैसे बोलें—WhatsApp खोलो, Telegram खोलो, या नौ एक और नंबर बोलकर कॉल।",
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

  if (looksIllegalOrUnsafeCommand(trimmed)) {
    pendingConfirmation = null;
    return {
      reply: cmdReply(
        "I can only help with legal and safe commands. Please ask a lawful action like open app, call, or music.",
        "मैं केवल कानूनी और सुरक्षित कमांड में मदद कर सकता हूँ। कृपया वैध कमांड बोलें।",
        trimmed,
        options?.speechLang,
      ),
      actions: [],
    };
  }

  if (hasActivePendingConfirmation()) {
    if (isConfirmYes(trimmed)) {
      const actions = pendingConfirmation?.actions ?? [];
      pendingConfirmation = null;
      return {
        reply: cmdReply("Confirmed. Executing now.", "पुष्टि हो गई, अभी कर रहा हूँ।", trimmed, options?.speechLang),
        actions,
      };
    }
    if (isConfirmNo(trimmed)) {
      pendingConfirmation = null;
      return {
        reply: cmdReply("Okay, cancelled.", "ठीक है, रद्द कर दिया।", trimmed, options?.speechLang),
        actions: [],
      };
    }
    return {
      reply: cmdReply(
        "Please say yes to confirm or no to cancel.",
        "कृपया पुष्टि के लिए हाँ बोलें, या रद्द करने के लिए नहीं बोलें।",
        trimmed,
        options?.speechLang,
      ),
      actions: [],
    };
  }

  if (mode === "voice-followup") {
    const r = runNeoIntents(trimmed, true, options?.speechLang);
    if (needsActionConfirmation(trimmed, r.actions)) {
      pendingConfirmation = {
        actions: r.actions,
        expiresAt: Date.now() + CONFIRM_TTL_MS,
        speechLang: options?.speechLang,
      };
      return {
        reply: cmdReply(
          "Please confirm. Should I proceed?",
          "कृपया पुष्टि करें। क्या मैं आगे बढ़ूं?",
          trimmed,
          options?.speechLang,
        ),
        actions: [],
      };
    }
    return r;
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
    const r = runNeoIntents(cmd, false, options?.speechLang);
    if (needsActionConfirmation(cmd, r.actions)) {
      pendingConfirmation = {
        actions: r.actions,
        expiresAt: Date.now() + CONFIRM_TTL_MS,
        speechLang: options?.speechLang,
      };
      return {
        reply: cmdReply(
          "Please confirm first. Say yes to continue or no to cancel.",
          "पहले पुष्टि करें। आगे बढ़ने के लिए हाँ, रद्द करने के लिए नहीं कहें।",
          trimmed,
          options?.speechLang,
        ),
        actions: [],
      };
    }
    return r;
  }

  /* voice — follow-up window: user may omit the wake phrase; strip it if they repeat “Neo …”. */
  if (isNeoFollowUpActive()) {
    const { hadWake, rest } = extractHelloNeoCommand(trimmed);
    if (hadWake && !rest.trim()) {
      startNeoFollowUpSession();
      const lang = options?.speechLang ?? DEFAULT_VOICE_SPEECH_LANG;
      return { reply: neoWakeAckPhrase(lang, options?.displayName), actions: [] };
    }
    const q = (hadWake && rest.trim() ? rest : trimmed).replace(/\s+/g, " ").trim();
    if (!q) {
      return { reply: "", actions: [] };
    }
    const r = runNeoIntents(q, true, options?.speechLang);
    if (needsActionConfirmation(q, r.actions)) {
      pendingConfirmation = {
        actions: r.actions,
        expiresAt: Date.now() + CONFIRM_TTL_MS,
        speechLang: options?.speechLang,
      };
      return {
        reply: cmdReply(
          "Please confirm. Should I continue?",
          "कृपया पुष्टि करें। क्या मैं जारी रखूं?",
          trimmed,
          options?.speechLang,
        ),
        actions: [],
      };
    }
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
    return { reply: neoWakeAckPhrase(lang, options?.displayName), actions: [] };
  }

  const r = runNeoIntents(rest, true, options?.speechLang);
  if (needsActionConfirmation(rest, r.actions)) {
    pendingConfirmation = {
      actions: r.actions,
      expiresAt: Date.now() + CONFIRM_TTL_MS,
      speechLang: options?.speechLang,
    };
    return {
      reply: cmdReply(
        "Please confirm this action. Say yes or no.",
        "इस क्रिया की पुष्टि करें। हाँ या नहीं बोलें।",
        trimmed,
        options?.speechLang,
      ),
      actions: [],
    };
  }
  if (r.actions.length > 0) clearNeoFollowUpSession();
  return r;
}

/** True when no shortcut intent matched — {@link HelloNeoVoiceStrip} may ask the chat model for a human reply. */
export function isVoiceGeneralHelpReply(reply: string): boolean {
  const t = reply.trim();
  if (!t) return false;
  return (
    t.includes("Try something like:") ||
    t.includes("जैसे बोलें") ||
    t.includes("Say Neo, then your command") ||
    t.includes("I didn't match that to a command")
  );
}

/** APK WebView: navigating to `whatsapp://`, `tel:`, etc. often shows “invalid link”; use native {@link NeoNativeRouter}. */
function openNativeExternalUri(url: string): void {
  const u = url.trim();
  if (!u) return;
  const lower = u.toLowerCase();
  const needsActivityIntent =
    lower.startsWith("whatsapp:") ||
    lower.startsWith("tg:") ||
    lower.startsWith("intent:") ||
    lower.startsWith("vnd.youtube:") ||
    lower.startsWith("tel:") ||
    (lower.startsWith("content://") && lower.includes("contacts"));
  if (!needsActivityIntent) {
    openNativeDeepLink(u);
    return;
  }
  void import("@/lib/neoNativeRouter")
    .then(({ NeoNativeRouter }) => NeoNativeRouter.openDeepLink({ url: u }))
    .then((r) => {
      if (r && r.opened === false) openNativeDeepLink(u);
    })
    .catch(() => {
      openNativeDeepLink(u);
    });
}

export function executeNeoActions(actions: NeoAction[]): void {
  const openUrlInBrowserTab = (url: string) => {
    if (typeof window === "undefined") return;
    try {
      const abs = new URL(url, window.location.href);
      const ext = /^https?:$/i.test(abs.protocol) && abs.origin !== window.location.origin;
      if (ext) {
        /* After async STT/TTS, `window.open` is often blocked — same-tab fallback so the action still runs. */
        const w = window.open(url, "_blank", "noopener,noreferrer");
        if (w == null) {
          window.location.assign(url);
        }
        return;
      }
    } catch {
      /* fall through */
    }
    window.location.assign(url);
  };

  for (const a of actions) {
    if (a.kind === "open_url") {
      if (isNativeCapacitor()) {
        const raw = (a.url || "").trim();
        const lower = raw.toLowerCase();
        if (lower.startsWith("neo-app:")) {
          const path = raw.slice("neo-app:".length).trim() || "/profile";
          void import("@/lib/neoNativeRouter")
            .then(({ NeoNativeRouter }) => NeoNativeRouter.openAppPath({ path }))
            .catch(() => {});
          continue;
        }
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
          /* APK voice: only native / app schemes — skip accidental web URLs. */
          continue;
        }
        openNativeExternalUri(a.url);
        continue;
      }
      const raw = (a.url || "").trim().toLowerCase();
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        openUrlInBrowserTab(a.url);
      } else {
        try {
          window.location.assign(a.url);
        } catch {
          /* ignore */
        }
      }
    } else if (a.kind === "tel") {
      if (isNativeCapacitor()) {
        openNativeExternalUri(a.href);
      } else {
        window.location.href = a.href;
      }
    }
  }
}
