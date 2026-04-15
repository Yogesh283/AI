import type { TtsVoiceGender } from "@/lib/voiceChat";

export const VOICE_PERSONA_STORAGE_KEY = "neo-voice-persona-id";

export type VoicePersona = {
  id: string;
  name: string;
  /** Public path under /public */
  imageSrc: string;
  ttsGender: TtsVoiceGender;
};

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: "arjun",
    name: "Arjun",
    imageSrc: "/avatars/persona-arjun.svg",
    ttsGender: "male",
  },
  {
    id: "sara",
    name: "Sara",
    imageSrc: "/avatars/persona-sara.svg",
    ttsGender: "female",
  },
];

export function getVoicePersona(id: string | null | undefined): VoicePersona {
  const found = VOICE_PERSONAS.find((p) => p.id === id);
  return found ?? VOICE_PERSONAS[0];
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
