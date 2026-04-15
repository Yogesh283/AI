/**
 * Browser voice: Web Speech API (STT) + speechSynthesis (TTS).
 * Chrome/Edge: best support. HTTPS or localhost required for mic in most browsers.
 *
 * TTS notes: voices load async (especially Chrome); we wait + pick a matching voice.
 * speechSynthesis can start "paused" — resume() before speak().
 */

import type { VoiceReplyMood } from "@/lib/voiceReplyMood";

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

export function createSpeechRecognition(lang = "en-IN"): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = lang;
  r.continuous = false;
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
    .replace(/[\uFE0F\u200D]/g, "");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Chrome often returns [] until voices load; poll getVoices() so Hindi/English voices appear.
 */
async function waitForVoices(maxMs = 3000): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    synth.getVoices();
    if (synth.getVoices().length > 0) return;
    await new Promise((r) => setTimeout(r, 100));
  }
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

export function rateForSpeedPreset(p: TtsSpeedPreset): number {
  switch (p) {
    case "slow":
      return 0.78;
    case "natural":
      /* Closer to conversational speech; pauses between chunks do the rest */
      return 0.84;
    case "fast":
      return 1.02;
    default:
      /* Slightly slower = clearer, less “robot” */
      return 0.86;
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
    /\bfemale\b|\bzira\b|\bsamantha\b|\bvictoria\b|\bfiona\b|\bjenny\b|\bhazel\b|\bheera\b|\bveena\b|\bswara\b|\bkalpana\b|\bpriya\b|\bsonia\b|\bneerja\b|\bananya\b|\barya\b|\bmadhur\b|\baria\b|\bnova\b|\btessa\b|\bkaren\b|\bsusan\b|\blinda\b|google uk english female|google us english|natural.*female|hindi.*female|india.*english.*female/i;
  const maleHints =
    /\bmale\b|\bdavid\b|\bgeorge\b|\bguy\b|\bfred\b|\bdaniel\b|\bjames\b|\brishi\b|\baarav\b|\barjun\b|\bprabhat\b|\bmicrosoft mark|google uk english male|natural.*male|hindi.*male|india.*english.*male/i;
  const f = femaleHints.test(n);
  const m = maleHints.test(n);
  if (f && !m) return "f";
  if (m && !f) return "m";
  return "u";
}

function primaryLangCode(lang: string): string {
  return lang.replace("_", "-").toLowerCase().split("-")[0] || "en";
}

function langRank(v: SpeechSynthesisVoice, want: string, primary: string): number {
  const L = v.lang.replace("_", "-").toLowerCase();
  if (L === want) return 5;
  if (L.startsWith(`${primary}-`) || L === primary) return 4;
  if (primary === "hi" && L.startsWith("hi")) return 4;
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
  if (/\b(neural|natural|wavenet|wave|generative|premium|polly|online)\b/.test(n)) b += 6;
  if (/microsoft\s+.*\s+natural\b/.test(n) || /\bnatural\s*-\s*/.test(n)) b += 5;
  if (/\bgoogle\b/.test(n) && (/\bindia\b|\bhindi\b|\bindic\b|\benglish\b/.test(n) || /hi-|en-in/i.test(v.lang)))
    b += 3;
  if (/\bmicrosoft\b/.test(n) && (/hi-in|en-in|hindi|india/i.test(v.lang) || /\bindia\b|\bhindi\b/.test(n)))
    b += 2;
  try {
    if ("localService" in v && (v as SpeechSynthesisVoice & { localService?: boolean }).localService === false)
      b += 2;
  } catch {
    /* ignore */
  }
  return b;
}

/** Break speech into phrase-sized chunks so the engine breathes between sentences (more human). */
function splitTtsChunks(text: string, maxLen = 300): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxLen) return [t];

  const sentences = t
    .split(/(?<=[.!?…])\s+/)
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
      const cut = rest.lastIndexOf(" ", maxLen);
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
): number {
  const primary = primaryLangCode(lang);
  let base = primary === "hi" ? 1.02 : 1;
  if (gender === "male") base -= 0.04;
  if (gender === "female") base += 0.018;

  const wobble = Math.sin((chunkIdx + 1) * 1.63) * 0.008;
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

  const p = base + moodBias + wobble;
  return Math.min(1.34, Math.max(0.72, p));
}

function pickVoice(lang: string, gender?: TtsVoiceGender): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined") return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;

  const want = lang.replace("_", "-").toLowerCase();
  const primary = want.split("-")[0] || want;

  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -1;
  for (const v of voices) {
    let s = langRank(v, want, primary) * 10 + genderRank(v, gender) * 4;
    if (v.name.includes("Google") && langRank(v, want, primary) >= 4) s += 2;
    s += voiceClarityBonus(v);
    if (primary === "hi" && /hindi|hi-in|indic|devanagari/i.test(`${v.name} ${v.lang}`)) s += 2;
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best ?? voices.find((x) => x.default) ?? voices[0];
}

/** Short pause between phrase chunks — closer to how people speak. */
function pauseAfterChunkMs(chunk: string, preset: TtsSpeedPreset): number {
  const t = chunk.trimEnd();
  const last = t.slice(-1);
  const mult =
    preset === "natural" ? 1.35 : preset === "slow" ? 1.2 : preset === "fast" ? 0.75 : 1;
  if (/[.!?…]/.test(last)) return Math.round(220 * mult);
  if (/[,;:]/.test(last)) return Math.round(110 * mult);
  return Math.round(75 * mult);
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
  const trimmed = textForTts(text);
  if (!trimmed) return;

  if (typeof window === "undefined" || !window.speechSynthesis) {
    throw new Error("Speech synthesis is not supported in this browser.");
  }

  const synth = window.speechSynthesis;
  await waitForVoices();

  synth.cancel();
  try {
    synth.resume();
  } catch {
    /* ignore */
  }

  const voice = pickVoice(lang, opts?.voiceGender);
  const preset = opts?.speedPreset ?? readTtsSpeedPreset();
  const baseRate = rateForSpeedPreset(preset);
  const mood = opts?.replyMood ?? "neutral";
  const chunks = splitTtsChunks(trimmed);

  const speakChunk = (chunk: string, chunkIdx: number) =>
    new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = lang;
      u.volume = 1;
      const rateWobble = 1 + Math.sin(chunkIdx * 0.9) * 0.005;
      u.rate = Math.min(1.18, Math.max(0.72, baseRate * rateWobble));
      u.pitch = utterancePitch(mood, lang, opts?.voiceGender, chunkIdx);
      if (voice) u.voice = voice;
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
