/**
 * Browser TTS for 3D avatar flow — pairs with Three.js speaking animation.
 * Uses Web Speech API SpeechSynthesis (same idea as the voice page).
 */

export function speakTextWithHooks(
  text: string,
  hooks: { onStart?: () => void; onEnd?: () => void },
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    hooks.onEnd?.();
    return;
  }
  const clean = (text || "").trim();
  if (!clean) {
    hooks.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "en-US";
  u.rate = 1;
  u.onstart = () => hooks.onStart?.();
  u.onend = () => hooks.onEnd?.();
  u.onerror = () => hooks.onEnd?.();
  window.speechSynthesis.speak(u);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}
