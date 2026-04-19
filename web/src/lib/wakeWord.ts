/**
 * Wake-word helpers (strip / match). Not used by the Voice page anymore — commands
 * like “open WhatsApp” run directly without a “say Neo first” gate.
 */

import type { VoiceSpeechLangCode } from "@/lib/voiceLanguages";

export const NEO_VOICE_WAKE_GATE_KEY = "neo-voice-wake-gate";

export function readWakeWordGateEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NEO_VOICE_WAKE_GATE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeWakeWordGateEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(NEO_VOICE_WAKE_GATE_KEY, "1");
    else window.localStorage.removeItem(NEO_VOICE_WAKE_GATE_KEY);
  } catch {
    /* ignore */
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercase + collapse spaces (Latin; names may still match). */
export function normalizeWakeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Phrases that count as the wake word — assistant brand name **Neo** (spoken by the user).
 */
export function buildWakePhrases(): string[] {
  const base = [
    "neo",
    "neoxai",
    "neo xai",
    "नियो",
    "नियोक्स एआई",
    "नियो एक्स ए आई",
  ];
  return [...new Set(base.map((x) => x.trim()).filter(Boolean))];
}

/**
 * If `transcript` starts with one of `phrases` (longest match first), returns remainder.
 * Otherwise `matched: false` and remainder is the full trimmed transcript.
 */
export function stripWakePrefix(
  transcript: string,
  phrases: string[],
): { matched: boolean; remainder: string } {
  const t = transcript.trim();
  if (!t) return { matched: false, remainder: "" };

  const norm = normalizeWakeText(t);
  const sorted = [...phrases]
    .filter(Boolean)
    .sort((a, b) => normalizeWakeText(b).length - normalizeWakeText(a).length);

  for (const raw of sorted) {
    const p = raw.trim();
    if (!p) continue;
    const pn = normalizeWakeText(p);
    if (!pn) continue;

    if (norm === pn) return { matched: true, remainder: "" };

    const reSpace = new RegExp(`^\\s*${escapeRegExp(p)}\\s+`, "i");
    const mSpace = t.match(reSpace);
    if (mSpace) return { matched: true, remainder: t.slice(mSpace[0].length).trim() };

    const reComma = new RegExp(`^\\s*${escapeRegExp(p)}\\s*,\\s*`, "i");
    const mComma = t.match(reComma);
    if (mComma) return { matched: true, remainder: t.slice(mComma[0].length).trim() };
  }

  return { matched: false, remainder: t };
}

export function wakeWordReminderLine(lang: VoiceSpeechLangCode): string {
  void lang;
  return "Say Neo first, then your question.";
}

/** Short hint for the Voice UI — user calls the assistant by the name Neo. */
export function wakePhraseHint(): string {
  return "Neo · NeoXAI";
}
