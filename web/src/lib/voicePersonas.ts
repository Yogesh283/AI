import type { TtsVoiceGender } from "@/lib/voiceChat";

export const VOICE_PERSONA_STORAGE_KEY = "neo-voice-persona-id";

export type VoicePersona = {
  id: string;
  name: string;
  /** Public path under /public */
  imageSrc: string;
  ttsGender: TtsVoiceGender;
};

/** Woman / man voice faces — IDs must match backend `ALLOWED_VOICE_PERSONA_IDS`. */
export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: "sara",
    name: "Sara",
    imageSrc: "/avatars/voice-care-hero.png",
    ttsGender: "female",
  },
  {
    id: "arjun",
    name: "Arjun",
    imageSrc: "/avatars/persona-arjun.svg",
    ttsGender: "male",
  },
];

export function getVoicePersona(id: string | null | undefined): VoicePersona {
  const found = VOICE_PERSONAS.find((p) => p.id === id);
  return found ?? VOICE_PERSONAS[0];
}

/** Only `arjun` and `sara` are supported end-to-end (API + TTS). */
export function normalizeVoicePersonaId(raw: string | null | undefined): "arjun" | "sara" {
  return raw === "arjun" ? "arjun" : "sara";
}

export function readStoredVoicePersonaId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(VOICE_PERSONA_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredVoicePersonaId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VOICE_PERSONA_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
