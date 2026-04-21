/**
 * While OpenAI Realtime (WebRTC) is active, run browser Web Speech (Google-backed on Chrome)
 * as a parallel user-transcript source. If Realtime’s `input_audio_transcription` is missing or late,
 * the debounced Google line fills voice history + persisted chat.
 *
 * Capacitor WebView: Web Speech may fail if the mic is exclusive to WebRTC — we still try;
 * if `start()` throws, caller gets null and Live-only applies.
 */

import { createSpeechRecognition } from "@/lib/voiceChat";

export type LiveGoogleSidecarHandle = {
  stop: () => void;
  /** Call whenever Realtime delivers `conversation.item.input_audio_transcription.completed`. */
  markLiveUserTranscript: () => void;
  /** Drop buffered Google text (e.g. assistant speaking / echo). */
  resetPending: () => void;
};

/** Only after OpenAI has *not* finalized a user line for this long do we emit Google text (avoids duplicates). */
const LIVE_GRACE_MS = 2000;
const FLUSH_DEBOUNCE_MS = 750;
const MIN_GAP_CHARS = 2;

export function startLiveGoogleTranscriptSidecar(opts: {
  langBcp47: string;
  isSessionActive: () => boolean;
  /** While assistant audio is playing, ignore Google results (reduces echo into STT). */
  isAssistantSpeaking: () => boolean;
  onGapFillUserText: (text: string) => void;
}): LiveGoogleSidecarHandle | null {
  if (typeof window === "undefined") return null;

  const rec = createSpeechRecognition(opts.langBcp47, { continuous: true });
  if (!rec) return null;

  let lastLiveUserAt = Date.now();
  let finalAcc = "";
  /** Latest non-final chunk — many engines only fire `isFinal` after a pause; interim carries “live” text. */
  let lastInterim = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let startRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const clearDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const flushIfEligible = () => {
    if (!opts.isSessionActive()) return;
    if (opts.isAssistantSpeaking()) return;
    const t = `${finalAcc} ${lastInterim}`.replace(/\s+/g, " ").trim();
    if (t.length < MIN_GAP_CHARS) return;
    if (Date.now() - lastLiveUserAt < LIVE_GRACE_MS) return;
    opts.onGapFillUserText(t);
    finalAcc = "";
    lastInterim = "";
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
    lastInterim = "";
    clearDebounce();
  };

  rec.onresult = (ev: SpeechRecognitionEvent) => {
    if (!opts.isSessionActive()) return;
    if (opts.isAssistantSpeaking()) return;
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const piece = (ev.results[i][0]?.transcript || "").trim();
      if (!piece) continue;
      if (ev.results[i].isFinal) {
        finalAcc = `${finalAcc} ${piece}`.replace(/\s+/g, " ").trim();
        lastInterim = "";
      } else {
        lastInterim = piece;
      }
      scheduleFlush();
    }
  };

  rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
    /* `aborted` is normal on stop(); `not-allowed` / `service-not-allowed` need user action. */
    if (ev.error === "aborted") return;
    if (ev.error === "no-speech") return;
    if (opts.isSessionActive() && !opts.isAssistantSpeaking()) {
      scheduleFlush();
    }
  };

  rec.onend = () => {
    if (stopped) return;
    if (opts.isSessionActive()) {
      try {
        rec.start();
      } catch {
        /* mic busy / policy */
      }
    }
  };

  const tryStartRecognition = (): boolean => {
    if (stopped) return false;
    try {
      rec.start();
      return true;
    } catch {
      return false;
    }
  };

  if (!tryStartRecognition()) {
    startRetryTimer = setTimeout(() => {
      startRetryTimer = null;
      if (stopped || !opts.isSessionActive()) return;
      void tryStartRecognition();
    }, 500);
  }

  return {
    stop: () => {
      stopped = true;
      if (startRetryTimer) {
        clearTimeout(startRetryTimer);
        startRetryTimer = null;
      }
      clearDebounce();
      finalAcc = "";
      lastInterim = "";
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
