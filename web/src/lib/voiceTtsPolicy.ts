import { isNativeCapacitor } from "@/lib/nativeAppLinks";
import { isSpeechSynthesisSupported } from "@/lib/voiceChat";

/**
 * Use `/api/voice/tts-audio` (OpenAI MP3) instead of browser `speechSynthesis`.
 * - Capacitor APK: WebView often has no `speechSynthesis` at all → must use server TTS.
 * - Mobile Chrome/Safari: speech may be blocked, empty voices, or silent until gesture.
 */
export function preferOpenAiTtsForVoiceUi(): boolean {
  if (typeof window === "undefined") return false;
  if (!isSpeechSynthesisSupported()) return true;
  if (isNativeCapacitor()) return true;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  /* Android System WebView often includes `wv` and still lacks reliable TTS. */
  if (/\bwv\b/i.test(ua)) return true;
  return false;
}
