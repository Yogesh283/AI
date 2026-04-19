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

/** Short spoken ack when the user switches language by voice (browser TTS). */
/** Short TTS after wake-only ("Neo" / "Hello Neo" with no command). Opens the follow-up command window. */
export function neoWakeAckPhrase(code: VoiceSpeechLangCode): string {
  switch (code) {
    case "hi-IN":
      return "सुन रहे हैं। बताइए क्या करवाना है—जैसे व्हाट्सऐप या यूट्यूब खुलवाना हो तो कह दीजिए।";
    case "en-IN":
    case "en-US":
      return "Yes — what would you like? For example, open WhatsApp, Telegram, or YouTube.";
    case "ta-IN":
    case "te-IN":
    case "bn-IN":
    case "mr-IN":
    case "gu-IN":
    case "kn-IN":
    case "ml-IN":
    case "pa-IN":
      return "Yes — what would you like me to do?";
    case "ur-IN":
      return "Yes — what would you like me to do?";
    case "es-ES":
      return "Sí, te escucho. Dime.";
    case "fr-FR":
      return "Oui, je t'entends. Vas-y.";
    case "de-DE":
      return "Ja, ich höre dich. Bitte weiter.";
    case "ar-SA":
      return "نعم، سمعتك. تفضل.";
    case "pt-BR":
      return "Sim, ouvi você. Pode falar.";
    case "ja-JP":
      return "はい、聞こえています。どうぞ。";
    case "ko-KR":
      return "네, 들었어요. 말씀하세요.";
    case "zh-CN":
      return "好的，我听到了。请说。";
    default:
      return "Yes — what would you like me to do?";
  }
}

/**
 * Spoken right before running an app / action — feels human, avoids an empty “mic is on” moment.
 * Gender matches Hello Neo TTS setting in Profile.
 */
export function neoWorkingAckPhrase(
  code: VoiceSpeechLangCode,
  gender: "male" | "female" = "female",
): string {
  if (code === "hi-IN" || (code || "").toLowerCase().startsWith("hi")) {
    return gender === "male" ? "बस एक पल, कर रहा हूँ।" : "बस एक पल, कर रही हूँ।";
  }
  return "On it — just a moment.";
}

export function ackPhraseForLang(code: VoiceSpeechLangCode): string {
  switch (code) {
    case "hi-IN":
      return "ठीक है, अब से केवल हिंदी में जवाब दूँगा।";
    case "en-IN":
    case "en-US":
      return "Okay, English from now.";
    case "ta-IN":
      return "Okay, Tamil from now.";
    case "te-IN":
      return "Okay, Telugu from now.";
    case "bn-IN":
      return "Okay, Bengali from now.";
    case "mr-IN":
      return "Okay, Marathi from now.";
    case "gu-IN":
      return "Okay, Gujarati from now.";
    case "kn-IN":
      return "Okay, Kannada from now.";
    case "ml-IN":
      return "Okay, Malayalam from now.";
    case "pa-IN":
      return "Okay, Punjabi from now.";
    case "ur-IN":
      return "Okay, Urdu from now.";
    case "es-ES":
      return "Okay, Spanish from now.";
    case "fr-FR":
      return "Okay, French from now.";
    case "de-DE":
      return "Okay, German from now.";
    case "ar-SA":
      return "Okay, Arabic from now.";
    case "pt-BR":
      return "Okay, Portuguese from now.";
    case "ja-JP":
      return "Okay, Japanese from now.";
    case "ko-KR":
      return "Okay, Korean from now.";
    case "zh-CN":
      return "Okay, Chinese from now.";
    default:
      return `Okay, ${voiceLangLabel(code)} from now.`;
  }
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
