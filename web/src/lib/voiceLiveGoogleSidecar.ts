/**
 * While OpenAI Realtime (WebRTC) is active, run browser Web Speech (Google-backed on Chrome)
 * as a parallel user-transcript source. If Realtime’s `input_audio_transcription` is missing or late,
 * the debounced Google line fills voice history + persisted chat.
 *
 * On many Android WebViews this may fail to start (mic contention) — then Live-only applies.
 */

import { createSpeechRecognition } from "@/lib/voiceChat";
import { isNativeCapacitor } from "@/lib/nativeAppLinks";

export type LiveGoogleSidecarHandle = {
  stop: () => void;
  /** Call whenever Realtime delivers `conversation.item.input_audio_transcription.completed`. */
  markLiveUserTranscript: () => void;
  /** Drop buffered Google text (e.g. assistant speaking / echo). */
  resetPending: () => void;
};

const LIVE_GRACE_MS = 2600;
const FLUSH_DEBOUNCE_MS = 1100;
const MIN_GAP_CHARS = 2;

export function startLiveGoogleTranscriptSidecar(opts: {
  langBcp47: string;
  isSessionActive: () => boolean;
  /** While assistant audio is playing, ignore Google results (reduces echo into STT). */
  isAssistantSpeaking: () => boolean;
  onGapFillUserText: (text: string) => void;
}): LiveGoogleSidecarHandle | null {
  if (typeof window === "undefined") return null;
  if (isNativeCapacitor()) return null;

  const rec = createSpeechRecognition(opts.langBcp47, { continuous: true });
  if (!rec) return null;

  let lastLiveUserAt = Date.now();
  let finalAcc = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const flushIfEligible = () => {
    if (!opts.isSessionActive()) return;
    if (opts.isAssistantSpeaking()) return;
    const t = finalAcc.replace(/\s+/g, " ").trim();
    if (t.length < MIN_GAP_CHARS) return;
    if (Date.now() - lastLiveUserAt < LIVE_GRACE_MS) return;
    opts.onGapFillUserText(t);
    finalAcc = "";
  };

  const scheduleFlush = () => {
    clearDebounce();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      flushIfEligible();
    }, FLUSH_DEBOUNCE_MS);
  };

  const markLiveUserTranscript = () => {
    lastLiveUserAt = Date.now();
  };

  const resetPending = () => {
    finalAcc = "";
    clearDebounce();
  };

  rec.onresult = (ev: SpeechRecognitionEvent) => {
    if (!opts.isSessionActive()) return;
    if (opts.isAssistantSpeaking()) return;
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const piece = ev.results[i][0].transcript;
      if (ev.results[i].isFinal && piece) {
        finalAcc = `${finalAcc} ${piece}`.replace(/\s+/g, " ").trim();
        scheduleFlush();
      }
    }
  };

  rec.onerror = () => {
    /* no-op — onend often follows */
  };

  rec.onend = () => {
    if (opts.isSessionActive()) {
      try {
        rec.start();
      } catch {
        /* mic busy / policy */
      }
    }
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      clearDebounce();
      finalAcc = "";
      try {
        rec.onend = null;
        rec.stop();
        (rec as SpeechRecognition & { abort?: () => void }).abort?.();
      } catch {
        /* ignore */
      }
    },
    markLiveUserTranscript,
    resetPending,
  };
}
