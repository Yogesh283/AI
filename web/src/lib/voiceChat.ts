/**
 * Browser voice: Web Speech API (STT) + speechSynthesis (TTS).
 * Chrome/Edge: best support. HTTPS or localhost required for mic in most browsers.
 *
 * TTS notes: voices load async (especially Chrome); we wait + pick a matching voice.
 * speechSynthesis can start "paused" — resume() before speak().
 */

import type { VoiceReplyMood } from "@/lib/voiceReplyMood";

type NativeSpeechPlugin = {
  available: () => Promise<{ available: boolean }>;
  checkPermissions: () => Promise<{ speechRecognition: "granted" | "denied" | "prompt" }>;
  requestPermissions: () => Promise<{ speechRecognition: "granted" | "denied" | "prompt" }>;
  start: (opts: {
    language?: string;
    maxResults?: number;
    partialResults?: boolean;
    popup?: boolean;
    prompt?: string;
  }) => Promise<void>;
  stop: () => Promise<void>;
  addListener: (
    eventName: "partialResults",
    listenerFunc: (data: { matches?: string[] }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
};

async function getNativeSpeechPlugin(): Promise<NativeSpeechPlugin | null> {
  if (typeof window === "undefined") return null;
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return null;
  const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
  return SpeechRecognition as unknown as NativeSpeechPlugin;
}

export async function isNativeSpeechRecognitionSupported(): Promise<boolean> {
  try {
    const plugin = await getNativeSpeechPlugin();
    if (!plugin) return false;
    const a = await plugin.available();
    return !!a.available;
  } catch {
    return false;
  }
}

export type NativeSpeechResult = { text: string; error: string | null };

/**
 * Native fallback for Android/iOS Capacitor builds where WebView speech can be blocked.
 * Captures one short utterance and returns best transcript.
 */
export async function captureNativeSpeechOnce(
  lang = "en-IN",
  onInterim?: (text: string) => void,
): Promise<NativeSpeechResult> {
  try {
    const plugin = await getNativeSpeechPlugin();
    if (!plugin) {
      return { text: "", error: "Native speech plugin unavailable." };
    }

    const avail = await plugin.available();
    if (!avail.available) {
      return { text: "", error: "Speech service unavailable on this device." };
    }

    let perms = await plugin.checkPermissions();
    if (perms.speechRecognition !== "granted") {
      perms = await plugin.requestPermissions();
    }
    if (perms.speechRecognition !== "granted") {
      return { text: "", error: "Mic blocked — app permission settings mein allow karein." };
    }

    let best = "";
    const handle = await plugin.addListener("partialResults", (data) => {
      const t = (data.matches?.[0] || "").trim();
      if (!t) return;
      best = t;
      onInterim?.(t);
    });

    try {
      await plugin.start({
        language: lang,
        maxResults: 1,
        partialResults: true,
        popup: false,
        prompt: "Speak now",
      });
      await new Promise((r) => setTimeout(r, 3600));
    } finally {
      try {
        await plugin.stop();
      } catch {
        /* ignore */
      }
      try {
        await handle.remove();
      } catch {
        /* ignore */
      }
    }

    return { text: best.trim(), error: null };
  } catch (e) {
    return { text: "", error: e instanceof Error ? e.message : "Native speech failed." };
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

function speechRecognitionErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
      return "Mic blocked — site settings mein allow karein.";
    case "no-speech":
      return "Kuch sunai nahi diya — zor se bolkar dubara try karein.";
    case "network":
      return "Speech service network error — internet check karein.";
    case "aborted":
      return "";
    case "audio-capture":
      return "Mic nahi mil raha — device check karein.";
    case "service-not-allowed":
      return "Browser ne speech service band ki hai.";
    default:
      return code ? `Speech: ${code}` : "Speech error";
  }
}

export type SpeechRecognitionOptions = {
  /** `true` = keep mic open across pauses — needed for interrupting assistant TTS (barge-in). */
  continuous?: boolean;
};

export function createSpeechRecognition(
  lang = "en-IN",
  opts?: SpeechRecognitionOptions,
): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = lang;
  r.continuous = opts?.continuous ?? false;
  r.interimResults = true;
  r.maxAlternatives = 1;
  return r;
}

/** Strip markdown-ish noise so TTS does not read asterisks and backticks. */
function textForTts(raw: string): string {
  const s = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/https?:\/\/\S+/gi, " ")
    // Emoji / pictographs — browsers often mumble or skip oddly
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/[\uFE0F\u200D]/g, "")
    // Cleanup: invisible chars, bullets, dash variants — cleaner, more human read
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .replace(/[—–]/g, " ")
    .replace(/[•▪‣·]/g, " ")
    .replace(/[""''„«»‹›]/g, '"')
    .replace(/…/g, ". ")
    .replace(/\.{4,}/g, "...")
    .replace(/[!?]{2,}/g, (m) => m[0] ?? "")
    .trim();
  return s.replace(/\s+/g, " ").trim();
}

function isNativeCapacitorSync(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * Chrome often returns [] until voices load; poll getVoices() so Hindi/English voices appear.
 * Capacitor Android WebView is slower / flaky — longer wait + voiceschanged.
 */
async function waitForVoices(maxMs = 2200): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  const limit = isNativeCapacitorSync() ? Math.max(maxMs, 7000) : maxMs;

  await new Promise<void>((resolve) => {
    const start = Date.now();
    let finished = false;
    let iv: number | undefined;
    const done = () => {
      if (finished) return;
      finished = true;
      synth.removeEventListener("voiceschanged", onVc);
      if (iv !== undefined) window.clearInterval(iv);
      resolve();
    };
    const onVc = () => {
      synth.getVoices();
    };
    synth.addEventListener("voiceschanged", onVc);
    iv = window.setInterval(() => {
      synth.getVoices();
      if (synth.getVoices().length > 0 || Date.now() - start >= limit) done();
    }, 70);
    synth.getVoices();
    if (synth.getVoices().length > 0) done();
  });
}

export type TtsVoiceGender = "male" | "female";

const TTS_GENDER_STORAGE_KEY = "neo-tts-gender";

/** Slower = easier to follow (especially Hindi + long replies). `natural` = human-like pacing + pauses. */
export type TtsSpeedPreset = "slow" | "natural" | "clear" | "fast";

const TTS_SPEED_STORAGE_KEY = "neo-tts-speed";

export function readTtsSpeedPreset(): TtsSpeedPreset {
  if (typeof window === "undefined") return "natural";
  try {
    const v = localStorage.getItem(TTS_SPEED_STORAGE_KEY);
    if (v === "slow" || v === "natural" || v === "clear" || v === "fast") return v;
  } catch {
    /* ignore */
  }
  return "natural";
}

export function writeTtsSpeedPreset(p: TtsSpeedPreset): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TTS_SPEED_STORAGE_KEY, p);
  } catch {
    /* ignore */
  }
}

/** Warmer / “heavier” vs brighter / “thinner” TTS pitch bias (browser SpeechSynthesis). */
export type TtsTonePreset = "warm" | "bright";

const TTS_TONE_STORAGE_KEY = "neo-tts-tone";

export function readTtsTonePreset(): TtsTonePreset {
  if (typeof window === "undefined") return "warm";
  try {
    const v = localStorage.getItem(TTS_TONE_STORAGE_KEY);
    if (v === "warm" || v === "bright") return v;
  } catch {
    /* ignore */
  }
  return "warm";
}

export function writeTtsTonePreset(p: TtsTonePreset): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TTS_TONE_STORAGE_KEY, p);
  } catch {
    /* ignore */
  }
}

export function rateForSpeedPreset(p: TtsSpeedPreset): number {
  switch (p) {
    case "slow":
      return 0.82;
    case "natural":
      /* Default — noticeably quicker while staying clear */
      return 0.93;
    case "clear":
      return 0.98;
    case "fast":
      return 1.08;
    default: {
      const _x: never = p;
      return _x;
    }
  }
}

export function readTtsGender(): TtsVoiceGender {
  if (typeof window === "undefined") return "female";
  try {
    const v = localStorage.getItem(TTS_GENDER_STORAGE_KEY);
    if (v === "male" || v === "female") return v;
  } catch {
    /* ignore */
  }
  return "female";
}

export function writeTtsGender(g: TtsVoiceGender): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TTS_GENDER_STORAGE_KEY, g);
  } catch {
    /* ignore */
  }
}

function prefersVoiceGender(name: string): "f" | "m" | "u" {
  const n = name.toLowerCase();
  const femaleHints =
    /\bfemale\b|\bzira\b|\bsamantha\b|\bvictoria\b|\bfiona\b|\bjenny\b|\bhazel\b|\bheera\b|\bveena\b|\bswara\b|\bkalpana\b|\bshruti\b|\bpriya\b|\bsonia\b|\bneerja\b|\bananya\b|\barya\b|\baria\b|\bnova\b|\btessa\b|\bkaren\b|\bsusan\b|\blinda\b|\bcatherine\b|\bmichelle\b|\bamy\b|\bemma\b|\bhannah\b|google uk english female|google us english|natural.*female|hindi.*female|india.*english.*female|microsoft.*female/i;
  const maleHints =
    /\bmale\b|\bdavid\b|\bgeorge\b|\bguy\b|\bfred\b|\bdaniel\b|\bjames\b|\brishi\b|\baarav\b|\barjun\b|\bprabhat\b|\bhemant\b|\bmadhur\b|\bravi\b|\bjitendra\b|\bmanish\b|\brahul\b|\bamit\b|\bmark\b|\bthomas\b|\bryan\b|\bsteven\b|\bmicrosoft mark\b|\bgoogle uk english male\b|natural.*male|hindi.*male|india.*english.*male|microsoft.*male/i;
  const f = femaleHints.test(n);
  const m = maleHints.test(n);
  if (f && !m) return "f";
  if (m && !f) return "m";
  return "u";
}

function primaryLangCode(lang: string): string {
  return lang.replace("_", "-").toLowerCase().split("-")[0] || "en";
}

function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

function effectiveSpeechLang(text: string, requestedLang: string): string {
  if (containsDevanagari(text) && primaryLangCode(requestedLang) !== "hi") {
    return "hi-IN";
  }
  return requestedLang;
}

/** Assigning a voice whose language does not match the utterance often yields silence (esp. Windows / Edge). */
function voiceMatchesUtteranceLang(v: SpeechSynthesisVoice, utteranceLang: string): boolean {
  const raw = (v.lang || "").trim();
  /* Many engines leave lang empty; skipping assignment then falls back to one default voice (gender ignored). */
  if (!raw) return true;
  const want = primaryLangCode(utteranceLang);
  const got = primaryLangCode(raw);
  if (want === got) return true;
  if (want === "en" && got === "en") return true;
  if (want === "hi" && got === "hi") return true;
  return false;
}

function langRank(v: SpeechSynthesisVoice, want: string, primary: string): number {
  const L = v.lang.replace("_", "-").toLowerCase();
  if (L === want) return primary === "hi" ? 8 : 5;
  if (L.startsWith(`${primary}-`) || L === primary) return primary === "hi" ? 6 : 4;
  if (primary === "hi" && L.startsWith("hi")) return 5;
  if (primary === "en" && L.startsWith("en")) return 4;
  return 1;
}

function genderRank(v: SpeechSynthesisVoice, gender?: TtsVoiceGender): number {
  if (!gender) return 1;
  const p = prefersVoiceGender(v.name);
  if (gender === "female") {
    if (p === "f") return 3;
    if (p === "u") return 2;
    return 1;
  }
  if (gender === "male") {
    if (p === "m") return 3;
    if (p === "u") return 2;
    return 1;
  }
  return 1;
}

/** Prefer neural / cloud voices — usually clearer and more “human” than legacy local ones. */
function voiceClarityBonus(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  let b = 0;
  if (/\b(neural|natural|wavenet|wave|generative|premium|polly|online|enhanced|multilingual)\b/.test(n))
    b += 7;
  if (/\b(hd|studio)\b/.test(n) && !/\bandroid\b/.test(n)) b += 2;
  if (/microsoft\s+.*\s+natural\b/.test(n) || /\bnatural\s*-\s*/.test(n)) b += 5;
  /* Slightly sweeter / smoother common presets on Windows & Edge */
  if (/\b(aria|jenny|sonia|neerja|samantha|zira|emma|amy|michelle|linda)\b/.test(n)) b += 2;
  if (/\b(ryan|guy|mark|david|james|daniel|jason)\b/.test(n)) b += 2;
  if (/\bgoogle\b/.test(n) && (/\bindia\b|\bhindi\b|\bindic\b|\benglish\b/.test(n) || /hi-|en-in/i.test(v.lang)))
    b += 3;
  if (/\bmicrosoft\b/.test(n) && (/hi-in|en-in|hindi|india/i.test(v.lang) || /\bindia\b|\bhindi\b/.test(n)))
    b += 2;
  /* Strongly prefer Indic/Hindi-capable engines for Devanagari (avoids English voice “reading” Hindi) */
  if (/hi-in|hi_in|^hi$/i.test(v.lang || "") || /\bhindi\b|devanagari|indic/i.test(n)) b += 12;
  try {
    if ("localService" in v && (v as SpeechSynthesisVoice & { localService?: boolean }).localService === false)
      b += 2;
  } catch {
    /* ignore */
  }
  return b;
}

/** Break speech into phrase-sized chunks so the engine breathes between sentences (more human). */
function splitTtsChunks(text: string, maxLen = 220, devanagari = false): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxLen) return [t];

  /* Include Hindi danda (।) and double danda (॥) — otherwise Hindi rarely splits and sounds garbled */
  const sentenceSplit = devanagari
    ? /(?<=[\u0964\u0965.!?…])\s+/
    : /(?<=[.!?…])\s+/;
  const sentences = t
    .split(sentenceSplit)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  let buf = "";

  const pushBuf = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = "";
  };

  const flushLong = (s: string) => {
    let rest = s;
    while (rest.length > maxLen) {
      const cut = devanagari
        ? Math.max(rest.lastIndexOf(" ", maxLen), rest.lastIndexOf(",", maxLen))
        : rest.lastIndexOf(" ", maxLen);
      const at = cut > 48 ? cut : maxLen;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    buf = rest;
  };

  for (const part of sentences.length ? sentences : [t]) {
    if (part.length > maxLen) {
      pushBuf();
      flushLong(part);
      pushBuf();
      continue;
    }
    const next = buf ? `${buf} ${part}` : part;
    if (next.length <= maxLen) {
      buf = next;
    } else {
      pushBuf();
      buf = part;
    }
  }
  pushBuf();
  return out.length ? out : [t];
}

function utterancePitch(
  mood: VoiceReplyMood,
  lang: string,
  gender: TtsVoiceGender | undefined,
  chunkIdx: number,
  tone: TtsTonePreset,
): number {
  const primary = primaryLangCode(lang);
  let base = primary === "hi" ? 1.02 : 1;
  /* Warmer, more natural — female slightly sweeter, male less flat */
  if (gender === "male") base -= 0.032;
  if (gender === "female") base += 0.028;

  const wobble =
    Math.sin((chunkIdx + 1) * 1.63) * (primary === "hi" ? 0.0015 : 0.003);
  const moodBias =
    mood === "laugh"
      ? 0.06
      : mood === "excited"
        ? 0.04
        : mood === "question"
          ? 0.025
          : mood === "think"
            ? -0.04
            : mood === "sympathy"
              ? -0.03
              : 0;

  const toneBias = tone === "bright" ? 0.065 : -0.028;
  const p = base + moodBias + wobble + toneBias;
  return Math.min(1.34, Math.max(0.72, p));
}

/** Drop known opposite-gender voices when the list still has alternatives (Windows often names voices clearly). */
function voicesEligibleForGender(
  voices: SpeechSynthesisVoice[],
  gender?: TtsVoiceGender,
): SpeechSynthesisVoice[] {
  if (!gender || voices.length === 0) return voices;
  const filtered = voices.filter((v) => {
    const p = prefersVoiceGender(v.name);
    if (gender === "female") return p !== "m";
    if (gender === "male") return p !== "f";
    return true;
  });
  return filtered.length > 0 ? filtered : voices;
}

function pickVoice(lang: string, gender?: TtsVoiceGender): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined") return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;

  const want = lang.replace("_", "-").toLowerCase();
  const primary = want.split("-")[0] || want;

  const hiAll = voices.filter((v) => primaryLangCode(v.lang || "") === "hi");
  let pool = voicesEligibleForGender(voices, gender);
  /* Never use an English-only voice for Hindi if any Hindi voice exists — fixes wrong words / accent */
  if (primary === "hi" && hiAll.length > 0) {
    const hiGendered = voicesEligibleForGender(hiAll, gender);
    pool = hiGendered.length > 0 ? hiGendered : hiAll;
  }

  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -1;
  for (const v of pool) {
    /* Stronger gender weight so Man/Woman beats “best neural” when both are same language tier */
    let s = langRank(v, want, primary) * 10 + genderRank(v, gender) * 11;
    if (v.name.includes("Google") && langRank(v, want, primary) >= 4) s += 2;
    s += voiceClarityBonus(v);
    if (primary === "hi" && /hindi|hi-in|indic|devanagari/i.test(`${v.name} ${v.lang}`)) s += 4;
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best ?? pool.find((x) => x.default) ?? pool[0];
}

/** Short pause between phrase chunks — closer to how people speak. */
function pauseAfterChunkMs(chunk: string, preset: TtsSpeedPreset): number {
  const t = chunk.trimEnd();
  const last = t.slice(-1);
  const mult =
    preset === "natural"
      ? 1.55
      : preset === "slow"
        ? 1.25
        : preset === "fast"
          ? 0.78
          : preset === "clear"
            ? 0.48 /* snappier flow — less “late” gap between sentences */
            : 1;
  if (/[.!?…]/.test(last)) return Math.round(275 * mult);
  if (/[,;:]/.test(last)) return Math.round(150 * mult);
  return Math.round(95 * mult);
}

export function prepareSpeechText(raw: string, maxChars = 540): string {
  let cleaned = textForTts(raw);
  if (!cleaned) {
    cleaned = (raw || "").replace(/\s+/g, " ").trim();
  }
  if (!cleaned) return "";
  if (cleaned.length <= maxChars) return cleaned;

  let clipped = cleaned.slice(0, maxChars);
  const sentenceCut = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("? "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("\u0964 "),
  );
  if (sentenceCut > Math.floor(maxChars * 0.6)) {
    clipped = clipped.slice(0, sentenceCut + 1);
  } else {
    const wordCut = clipped.lastIndexOf(" ");
    if (wordCut > 40) clipped = clipped.slice(0, wordCut);
  }
  return `${clipped.trim()}...`;
}

/** Prime the voice list (call from Voice page on mount + after user gesture helps Chrome). */
export function primeSpeechVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.getVoices();
  } catch {
    /* ignore */
  }
}

export async function speakText(
  text: string,
  lang = "en-IN",
  opts?: {
    voiceGender?: TtsVoiceGender;
    speedPreset?: TtsSpeedPreset;
    /** From `inferVoiceReplyMood` — shapes pitch and pacing per phrase. */
    replyMood?: VoiceReplyMood;
    /** Fires on browser TTS boundary events (word/sentence), for UI sync. */
    onSpeechBoundary?: () => void;
  }
): Promise<void> {
  let trimmed = textForTts(text);
  if (!trimmed) {
    trimmed = (text || "").replace(/\s+/g, " ").trim();
  }
  if (!trimmed) return;

  if (typeof window === "undefined" || !window.speechSynthesis) {
    throw new Error("Speech synthesis is not supported in this browser.");
  }

  const synth = window.speechSynthesis;
  await waitForVoices();
  primeSpeechVoices();

  synth.cancel();
  try {
    synth.resume();
  } catch {
    /* ignore */
  }

  const preset = opts?.speedPreset ?? readTtsSpeedPreset();
  const baseRate = rateForSpeedPreset(preset);
  const mood = opts?.replyMood ?? "neutral";
  const tone = readTtsTonePreset();
  const isDeva = containsDevanagari(trimmed);
  /* Hindi: longer chunks + danda-aware splits = fewer mid-word glitches; slightly shorter when “slow” */
  const chunkMaxLen =
    preset === "clear" || preset === "fast"
      ? 300
      : preset === "slow"
        ? isDeva
          ? 220
          : 190
        : isDeva
          ? 240
          : 200;
  const chunks = splitTtsChunks(trimmed, chunkMaxLen, isDeva);

  const speakChunk = (chunk: string, chunkIdx: number) =>
    new Promise<void>((resolve, reject) => {
      const chunkLang = effectiveSpeechLang(chunk, lang);
      const voice = pickVoice(chunkLang, opts?.voiceGender);
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = chunkLang;
      u.volume = 1;
      const rateWobble = 1 + Math.sin(chunkIdx * 0.9) * 0.001;
      const isHi = primaryLangCode(chunkLang) === "hi";
      /* Hindi needs slower rate on most engines — avoids slurred / wrong syllables */
      const hiRateMul = isHi ? 1.02 : 1;
      u.rate = Math.min(1.16, Math.max(0.68, baseRate * rateWobble * hiRateMul));
      u.pitch = utterancePitch(mood, chunkLang, opts?.voiceGender, chunkIdx, tone);
      if (voice && voiceMatchesUtteranceLang(voice, chunkLang)) {
        u.voice = voice;
      }
      u.onboundary = () => {
        opts?.onSpeechBoundary?.();
      };

      u.onend = () => resolve();
      u.onerror = (ev) => {
        const err = (ev as SpeechSynthesisErrorEvent).error;
        if (err === "interrupted" || err === "canceled") {
          resolve();
          return;
        }
        reject(new Error(`TTS: ${err}`));
      };

      try {
        synth.resume();
        synth.speak(u);
        if (typeof window !== "undefined" && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (e) {
        reject(e instanceof Error ? e : new Error("TTS speak failed"));
      }
    });

  for (let i = 0; i < chunks.length; i++) {
    await speakChunk(chunks[i], i);
    if (i < chunks.length - 1) {
      await new Promise<void>((r) => setTimeout(r, pauseAfterChunkMs(chunks[i], preset)));
    }
  }
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export { speechRecognitionErrorMessage };
