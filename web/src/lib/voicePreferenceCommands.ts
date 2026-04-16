/**
 * Detect spoken preferences (language / voice persona) and strip them from the utterance.
 * Users can say e.g. "I want to speak in Hindi", "mujhe Tamil mein baat karni hai", "switch to Spanish".
 */

import type { VoiceSpeechLangCode } from "@/lib/voiceLanguages";

export type VoicePreferenceApply = {
  lang?: VoiceSpeechLangCode;
  personaId?: "arjun" | "sara";
};

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phrasesForSpokenName(
  code: VoiceSpeechLangCode,
  names: string[],
): { re: RegExp; apply: VoicePreferenceApply }[] {
  const out: { re: RegExp; apply: VoicePreferenceApply }[] = [];
  for (const raw of names) {
    const n = escRe(raw);
    out.push(
      {
        re: new RegExp(`\\b(i\\s+)?want\\s+to\\s+(speak|talk)\\s+in\\s+${n}\\b`, "gi"),
        apply: { lang: code },
      },
      {
        re: new RegExp(`\\b(speak|talk)\\s+in\\s+${n}\\b`, "gi"),
        apply: { lang: code },
      },
      {
        re: new RegExp(`\\bswitch\\s+to\\s+${n}\\b`, "gi"),
        apply: { lang: code },
      },
      { re: new RegExp(`\\buse\\s+${n}\\b`, "gi"), apply: { lang: code } },
      { re: new RegExp(`\\b${n}\\s+language\\b`, "gi"), apply: { lang: code } },
      { re: new RegExp(`\\b${n}\\s+only\\b`, "gi"), apply: { lang: code } },
    );
  }
  return out;
}

const EXTRA_LANG_NAMES: Partial<Record<VoiceSpeechLangCode, string[]>> = {
  "ta-IN": ["tamil"],
  "te-IN": ["telugu"],
  "bn-IN": ["bengali", "bangla"],
  "mr-IN": ["marathi"],
  "gu-IN": ["gujarati"],
  "kn-IN": ["kannada"],
  "ml-IN": ["malayalam"],
  "pa-IN": ["punjabi"],
  "ur-IN": ["urdu"],
  "es-ES": ["spanish", "español", "espanol"],
  "fr-FR": ["french", "français", "francais"],
  "de-DE": ["german", "deutsch"],
  "ar-SA": ["arabic"],
  "pt-BR": ["portuguese", "português", "portugues"],
  "ja-JP": ["japanese", "nihongo"],
  "ko-KR": ["korean", "hangul"],
  "zh-CN": ["chinese", "mandarin", "putonghua"],
  "en-US": ["american english", "us english", "english us"],
};

const PHRASES: { re: RegExp; apply: VoicePreferenceApply }[] = [
  /* Hindi — English */
  { re: /\b(i\s+)?want\s+to\s+(speak|talk)\s+in\s+hindi\b/gi, apply: { lang: "hi-IN" } },
  { re: /\bspeak\s+in\s+hindi\b/gi, apply: { lang: "hi-IN" } },
  { re: /\btalk\s+in\s+hindi\b/gi, apply: { lang: "hi-IN" } },
  { re: /\bhindi\s+only\b/gi, apply: { lang: "hi-IN" } },
  { re: /\bhindi\s+(mein|me|may)\b/gi, apply: { lang: "hi-IN" } },
  { re: /\buse\s+hindi\b/gi, apply: { lang: "hi-IN" } },
  { re: /\bswitch\s+to\s+hindi\b/gi, apply: { lang: "hi-IN" } },
  { re: /\bhindi\s+language\b/gi, apply: { lang: "hi-IN" } },
  /* English — India */
  { re: /\b(i\s+)?want\s+to\s+(speak|talk)\s+in\s+english\b/gi, apply: { lang: "en-IN" } },
  { re: /\bspeak\s+in\s+english\b/gi, apply: { lang: "en-IN" } },
  { re: /\btalk\s+in\s+english\b/gi, apply: { lang: "en-IN" } },
  { re: /\benglish\s+only\b/gi, apply: { lang: "en-IN" } },
  { re: /\buse\s+english\b/gi, apply: { lang: "en-IN" } },
  { re: /\bswitch\s+to\s+english\b/gi, apply: { lang: "en-IN" } },
  { re: /\benglish\s+language\b/gi, apply: { lang: "en-IN" } },
  /* Hinglish — Hindi */
  { re: /\b(mujhe|muje)\s+hindi\s+(mein|may|mai)\b/gi, apply: { lang: "hi-IN" } },
  { re: /\bhindi\s+mein\s+(baat|bol)/gi, apply: { lang: "hi-IN" } },
  { re: /\bhindi\s+mein\s+baat\s+karni\b/gi, apply: { lang: "hi-IN" } },
  { re: /\bbaat\s+karni\s+hai\s+hindi\s+mein\b/gi, apply: { lang: "hi-IN" } },
  { re: /\bhindi\s+mein\s+bolna\b/gi, apply: { lang: "hi-IN" } },
  { re: /\bab\s+se\s+hindi\b/gi, apply: { lang: "hi-IN" } },
  /* Hinglish — English */
  { re: /\b(mujhe|muje)\s+english\s+(mein|may|mai)\b/gi, apply: { lang: "en-IN" } },
  { re: /\benglish\s+mein\s+(baat|bol)/gi, apply: { lang: "en-IN" } },
  { re: /\benglish\s+mein\s+baat\s+karni\b/gi, apply: { lang: "en-IN" } },
  { re: /\bbaat\s+karni\s+hai\s+english\s+mein\b/gi, apply: { lang: "en-IN" } },
  { re: /\benglish\s+mein\s+bolna\b/gi, apply: { lang: "en-IN" } },
  { re: /\bab\s+se\s+english\b/gi, apply: { lang: "en-IN" } },
  /* Roman Hindi: "Tamil mein", "Telugu mein", … */
  { re: /\btamil\s+(mein|may|mai)\b/gi, apply: { lang: "ta-IN" } },
  { re: /\btelugu\s+(mein|may|mai)\b/gi, apply: { lang: "te-IN" } },
  { re: /\bbengali\s+(mein|may|mai)\b/gi, apply: { lang: "bn-IN" } },
  { re: /\bbangla\s+(mein|may|mai)\b/gi, apply: { lang: "bn-IN" } },
  { re: /\bmarathi\s+(mein|may|mai)\b/gi, apply: { lang: "mr-IN" } },
  { re: /\bgujarati\s+(mein|may|mai)\b/gi, apply: { lang: "gu-IN" } },
  { re: /\bkannada\s+(mein|may|mai)\b/gi, apply: { lang: "kn-IN" } },
  { re: /\bmalayalam\s+(mein|may|mai)\b/gi, apply: { lang: "ml-IN" } },
  { re: /\bpunjabi\s+(mein|may|mai)\b/gi, apply: { lang: "pa-IN" } },
  { re: /\burdu\s+(mein|may|mai)\b/gi, apply: { lang: "ur-IN" } },
  /* Persona — male / Arjun */
  { re: /\b(male|man'?s?)\s+voice\b/gi, apply: { personaId: "arjun" } },
  { re: /\buse\s+(the\s+)?male\s+voice\b/gi, apply: { personaId: "arjun" } },
  { re: /\bman's\s+voice\b/gi, apply: { personaId: "arjun" } },
  { re: /\bswitch\s+to\s+(male|arjun)\b/gi, apply: { personaId: "arjun" } },
  { re: /\b(purush|aadmi)\s+(ki\s+)?(awaaz|voice)\b/gi, apply: { personaId: "arjun" } },
  /* Persona — female / Sara */
  { re: /\b(female|woman'?s?)\s+voice\b/gi, apply: { personaId: "sara" } },
  { re: /\buse\s+(the\s+)?female\s+voice\b/gi, apply: { personaId: "sara" } },
  { re: /\bwoman'?s\s+voice\b/gi, apply: { personaId: "sara" } },
  { re: /\bswitch\s+to\s+(female|sara)\b/gi, apply: { personaId: "sara" } },
  { re: /\b(mahila|ladki)\s+(ki\s+)?(awaaz|voice)\b/gi, apply: { personaId: "sara" } },
];

for (const [code, names] of Object.entries(EXTRA_LANG_NAMES)) {
  PHRASES.push(...phrasesForSpokenName(code as VoiceSpeechLangCode, names));
}

export function stripVoicePreferencePhrases(raw: string): {
  cleaned: string;
  prefs: VoicePreferenceApply[];
} {
  let s = raw;
  const prefs: VoicePreferenceApply[] = [];
  for (const { re, apply } of PHRASES) {
    re.lastIndex = 0;
    if (re.test(s)) {
      prefs.push(apply);
      s = s.replace(re, " ");
    }
  }
  const cleaned = s.replace(/\s+/g, " ").trim();
  return { cleaned, prefs };
}

export function mergeVoicePreferences(prefs: VoicePreferenceApply[]): VoicePreferenceApply {
  const out: VoicePreferenceApply = {};
  for (const p of prefs) {
    if (p.lang) out.lang = p.lang;
    if (p.personaId) out.personaId = p.personaId;
  }
  return out;
}
