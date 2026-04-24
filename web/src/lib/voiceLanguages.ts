/**
 * Speech recognition + TTS locale codes (BCP-47). Browser support varies by OS;
 * Chrome/Edge generally offer the widest set.
 */

export const VOICE_SPEECH_LANGS = [
  { code: "en-IN" as const, label: "English (India)", short: "EN·IN" },
  { code: "en-US" as const, label: "English (US)", short: "EN·US" },
  { code: "hi-IN" as const, label: "Hindi", short: "HI" },
  { code: "ta-IN" as const, label: "Tamil", short: "TA" },
  { code: "te-IN" as const, label: "Telugu", short: "TE" },
  { code: "bn-IN" as const, label: "Bengali", short: "BN" },
  { code: "mr-IN" as const, label: "Marathi", short: "MR" },
  { code: "gu-IN" as const, label: "Gujarati", short: "GU" },
  { code: "kn-IN" as const, label: "Kannada", short: "KN" },
  { code: "ml-IN" as const, label: "Malayalam", short: "ML" },
  { code: "pa-IN" as const, label: "Punjabi", short: "PA" },
  { code: "ur-IN" as const, label: "Urdu", short: "UR" },
  { code: "es-ES" as const, label: "Spanish", short: "ES" },
  { code: "fr-FR" as const, label: "French", short: "FR" },
  { code: "de-DE" as const, label: "German", short: "DE" },
  { code: "ar-SA" as const, label: "Arabic", short: "AR" },
  { code: "pt-BR" as const, label: "Portuguese (Brazil)", short: "PT" },
  { code: "ja-JP" as const, label: "Japanese", short: "JA" },
  { code: "ko-KR" as const, label: "Korean", short: "KO" },
  { code: "zh-CN" as const, label: "Chinese (Mandarin)", short: "ZH" },
] as const;

export type VoiceSpeechLangCode = (typeof VOICE_SPEECH_LANGS)[number]["code"];

export const DEFAULT_VOICE_SPEECH_LANG: VoiceSpeechLangCode = "en-IN";

const STORAGE_KEY = "neo-voice-speech-lang";

export function isVoiceSpeechLang(s: string): s is VoiceSpeechLangCode {
  return VOICE_SPEECH_LANGS.some((x) => x.code === s);
}

export function normalizeVoiceSpeechLang(s: string): VoiceSpeechLangCode {
  return isVoiceSpeechLang(s) ? s : DEFAULT_VOICE_SPEECH_LANG;
}

export function readStoredVoiceSpeechLang(): VoiceSpeechLangCode {
  if (typeof window === "undefined") return DEFAULT_VOICE_SPEECH_LANG;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && isVoiceSpeechLang(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_VOICE_SPEECH_LANG;
}

export function writeStoredVoiceSpeechLang(code: VoiceSpeechLangCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function voiceLangLabel(code: VoiceSpeechLangCode): string {
  return VOICE_SPEECH_LANGS.find((x) => x.code === code)?.label ?? code;
}

/** Short TTS after wake-only ("Neo" / "Hello Neo" with no command). Opens the follow-up command window. */
export function neoWakeAckPhrase(code: VoiceSpeechLangCode, displayName?: string | null): string {
  const nm = displayName?.trim();
  if (code.startsWith("hi")) {
    return nm
      ? `नमस्ते ${nm} जी, बोलिए। क्या चाहिए—YouTube, WhatsApp, कॉल, या कोई ऐप?`
      : `नमस्ते, बोलिए। क्या चाहिए—YouTube, WhatsApp, या कॉल?`;
  }
  return nm
    ? `Hi ${nm} — I'm listening. What would you like? Try music, WhatsApp, a call, or any app.`
    : `Hi — I'm listening. What would you like? You can ask for music, WhatsApp, a call, or any app.`;
}

/** Played when the user taps Try Neo (before one-shot listen). Smooth bilingual by speech locale. */
export function neoVoiceCommandSessionGreeting(code: VoiceSpeechLangCode, displayName?: string | null): string {
  const nm = displayName?.trim();
  if (code.startsWith("hi")) {
    return nm
      ? `नमस्ते ${nm} जी… आराम से बोलिए, मैं सुन रहा हूँ। जो चाहें—खोलना, सवाल, या बस बात।`
      : `नमस्ते… आराम से बोलिए, मैं सुन रहा हूँ।`;
  }
  return nm
    ? `Hey ${nm}… take your time. I'm listening — ask for anything, or just talk.`
    : `Hey… take your time. I'm listening — ask for anything, or just talk.`;
}

/**
 * Spoken right before running an app / action — feels human, avoids an empty “mic is on” moment.
 * Gender matches Hello Neo TTS setting in Profile.
 */
export function neoWorkingAckPhrase(
  code: VoiceSpeechLangCode,
  _gender: "male" | "female" = "female",
): string {
  if (code.startsWith("hi")) {
    return "ठीक है… थोड़ा समय दीजिए, कर रहा हूँ।";
  }
  return "Alright… give me just a moment.";
}

export function ackPhraseForLang(code: VoiceSpeechLangCode): string {
  return `Okay — ${voiceLangLabel(code)} from now.`;
}

/** Greeting when the user starts a voice session — short hello + optional name only. */
export function voiceSessionWelcomeLines(
  lang: VoiceSpeechLangCode,
  displayName: string | undefined,
): { isHindi: boolean; withName: string; withoutName: string } {
  const nm = displayName?.trim();
  return {
    isHindi: false,
    withName: nm ? `Hello ${nm}.` : "Hello.",
    withoutName: "Hello.",
  };
}
