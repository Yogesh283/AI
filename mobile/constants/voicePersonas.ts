/** Same storage key as web `voicePersonas.ts` so picks stay in sync when using web + app. */
export const VOICE_PERSONA_STORAGE_KEY = "neo-voice-persona-id";

export type VoicePersonaId = "sara" | "arjun";

export function normalizeVoicePersonaId(raw: string | null): VoicePersonaId {
  if (raw === "arjun") return "arjun";
  return "sara";
}
