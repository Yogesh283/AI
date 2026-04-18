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

/**
 * After assistant TTS, wait before reopening the mic — avoids Android/WebView glitchy capture when
 * playback just released audio focus (robotic / late / noisy first words).
 */
export function voiceChatResumeMicDelayMs(): number {
  if (typeof window === "undefined") return 220;
  if (isNativeCapacitor()) return 620;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return 480;
  return 260;
}
