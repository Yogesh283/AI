/**
 * TTS for voice + 3D avatar: Kalidokit-style mouth shapes via ref.
 * - Prefer OpenAI MP3 (`/api/voice/tts-audio`) + Web Audio analyser → realistic lip sync.
 * - Fallback: Web Speech API + synthetic mouth shapes (no audio buffer).
 */

import { apiOrigin } from "@/lib/apiBase";
import { isNativeCapacitor } from "@/lib/nativeAppLinks";
import {
  isSpeechSynthesisSupported,
  prepareSpeechText,
  speakText,
  stopSpeaking,
  type TtsVoiceGender,
  type TtsSpeedPreset,
  type TtsTonePreset,
} from "@/lib/voiceChat";
import type { VoiceReplyMood } from "@/lib/voiceReplyMood";
import type { KalidokitMouthShape } from "@/lib/vrmKalidokitMouth";
import { EMPTY_MOUTH_SHAPE } from "@/lib/vrmKalidokitMouth";
import { mouthShapeFromFrequencyData, syntheticMouthShapeFromTime } from "@/lib/audioMouthShape";

let activeAudio: HTMLAudioElement | null = null;
let activeRaf = 0;
let activeAnalyser: AnalyserNode | null = null;
let activeAudioCtx: AudioContext | null = null;

function stopRafLoop() {
  if (activeRaf) {
    cancelAnimationFrame(activeRaf);
    activeRaf = 0;
  }
}

function cleanupAudioGraph() {
  try {
    activeAnalyser?.disconnect();
  } catch {
    /* ignore */
  }
  activeAnalyser = null;
  try {
    if (activeAudioCtx && activeAudioCtx.state !== "closed") {
      void activeAudioCtx.close();
    }
  } catch {
    /* ignore */
  }
  activeAudioCtx = null;
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.removeAttribute("src");
      URL.revokeObjectURL(activeAudio.src);
    } catch {
      /* ignore */
    }
    activeAudio = null;
  }
}

/** Stop OpenAI TTS playback + lip-sync loop (call alongside speechSynthesis.cancel). */
export function stopAvatarTtsAudio(): void {
  stopRafLoop();
  cleanupAudioGraph();
}

/**
 * Play MP3 blob; updates `mouthShapeRef` each frame from analyser until `ended`.
 */
export async function playMp3BlobWithLipSync(
  blob: Blob,
  mouthShapeRef: { current: KalidokitMouthShape },
): Promise<void> {
  stopAvatarTtsAudio();

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = 1;
  try {
    audio.setAttribute("playsInline", "true");
  } catch {
    /* ignore */
  }
  activeAudio = audio;

  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    URL.revokeObjectURL(url);
    throw new Error("Web Audio not supported");
  }

  const ctx = new AudioContextCtor();
  activeAudioCtx = ctx;
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => undefined);
  }

  const source = ctx.createMediaElementSource(audio);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.65;
  activeAnalyser = analyser;

  const data = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  analyser.connect(ctx.destination);

  const tick = () => {
    if (!activeAnalyser || !activeRaf) return;
    activeAnalyser.getByteFrequencyData(data);
    const t = performance.now() * 0.001;
    mouthShapeRef.current = mouthShapeFromFrequencyData(data, t);
    activeRaf = requestAnimationFrame(tick);
  };

  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      stopRafLoop();
      mouthShapeRef.current = { ...EMPTY_MOUTH_SHAPE };
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
      /* Let the output device settle before closing Web Audio (fewer glitches when mic starts next). */
      requestAnimationFrame(() => {
        cleanupAudioGraph();
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
        resolve();
      });
    };
    audio.onerror = () => {
      stopRafLoop();
      mouthShapeRef.current = { ...EMPTY_MOUTH_SHAPE };
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
      requestAnimationFrame(() => {
        cleanupAudioGraph();
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
        reject(new Error("Audio playback error"));
      });
    };

    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    void audio
      .play()
      .then(() => {
        activeRaf = requestAnimationFrame(tick);
      })
      .catch((e) => {
        stopRafLoop();
        cleanupAudioGraph();
        URL.revokeObjectURL(url);
        reject(e instanceof Error ? e : new Error("Audio play failed"));
      });
  });
}

/**
 * OpenAI `gpt-4o-mini-tts` + **marin** / **cedar** + human-like pacing instructions (OpenAI recommends marin/cedar for dialogue).
 * Other OpenAI paths default to `tts-1-hd` + nova/onyx unless a model is set explicitly.
 */
const HUMAN_LIKE_TTS_INSTRUCTIONS =
  "Speak as a real person would on a voice call: warm, relaxed chest voice, slightly slower than news-radio, with tiny natural pauses between phrases. Vary pitch and rhythm a little so it never sounds monotone or machine-read. Clear consonants; if Hindi and English mix, keep both easy to follow. Sound caring and present, not salesy or robotic.";

/**
 * OpenAI TTS voice ids (see backend `_OPENAI_TTS_VOICES`).
 */
function openAiTtsVoiceId(
  gender: TtsVoiceGender | undefined,
  style: "default" | "conversation",
): string {
  if (style === "conversation") {
    return gender === "male" ? "cedar" : "marin";
  }
  return gender === "male" ? "onyx" : "nova";
}

async function fetchOpenAiTtsBlob(
  text: string,
  voiceGender: TtsVoiceGender | undefined,
  fetchOpts?: {
    model?: "tts-1" | "tts-1-hd" | "gpt-4o-mini-tts";
    voiceStyle?: "default" | "conversation";
  },
): Promise<Blob> {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new Error("TTS: empty text");
  }

  const voiceStyle = fetchOpts?.voiceStyle === "conversation" ? "conversation" : "default";
  const model: "tts-1" | "tts-1-hd" | "gpt-4o-mini-tts" =
    fetchOpts?.model === "gpt-4o-mini-tts"
      ? "gpt-4o-mini-tts"
      : fetchOpts?.model === "tts-1"
        ? "tts-1"
        : fetchOpts?.model === "tts-1-hd"
          ? "tts-1-hd"
          : "tts-1-hd";

  const payload: Record<string, unknown> = {
    text: trimmed,
    voice: openAiTtsVoiceId(voiceGender, voiceStyle),
    model,
  };
  if (model === "gpt-4o-mini-tts" && voiceStyle === "conversation") {
    payload.instructions = HUMAN_LIKE_TTS_INSTRUCTIONS;
  }

  const res = await fetch(`${apiOrigin()}/api/voice/tts-audio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const hint = await res.text().catch(() => "");
    throw new Error(`TTS HTTP ${res.status}: ${hint.slice(0, 200)}`);
  }
  const blob = await res.blob();
  if (!blob.size) {
    throw new Error("TTS returned empty audio");
  }
  return blob;
}

/**
 * MP3 playback without Web Audio analyser (Hello Neo strip, short replies — APK WebView has no `speechSynthesis`).
 */
async function playMp3BlobSimple(blob: Blob): Promise<void> {
  stopAvatarTtsAudio();

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = 1;
  try {
    audio.setAttribute("playsInline", "true");
  } catch {
    /* ignore */
  }
  activeAudio = audio;

  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      try {
        audio.pause();
        audio.removeAttribute("src");
      } catch {
        /* ignore */
      }
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      activeAudio = null;
      resolve();
    };
    audio.onerror = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      activeAudio = null;
      reject(new Error("Audio playback error"));
    };
    const start = async () => {
      try {
        try {
          audio.load?.();
        } catch {
          /* ignore */
        }
        await audio.play();
      } catch (e) {
        try {
          await new Promise((r) => setTimeout(r, 120));
          await audio.play();
        } catch (e2) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            /* ignore */
          }
          activeAudio = null;
          reject(e2 instanceof Error ? e2 : new Error(String(e2)));
        }
      }
    };
    void start();
  });
}

/**
 * APK / WebView: Web Audio `createMediaElementSource` is often broken or silent — use `<audio>` only
 * and drive mouth shapes synthetically (same idea as `speechSynthesis` fallback).
 */
async function playMp3BlobSimpleWithSyntheticMouth(
  blob: Blob,
  mouthShapeRef: { current: KalidokitMouthShape },
): Promise<void> {
  stopRafLoop();

  let rafId = 0;
  let stopped = false;
  const loop = () => {
    if (stopped) return;
    const t = performance.now() * 0.001;
    mouthShapeRef.current = syntheticMouthShapeFromTime(t);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  try {
    await playMp3BlobSimple(blob);
  } finally {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    mouthShapeRef.current = { ...EMPTY_MOUTH_SHAPE };
  }
}

async function tryOpenAiTts(
  text: string,
  mouthShapeRef: { current: KalidokitMouthShape },
  voiceGender: TtsVoiceGender | undefined,
  fetchOpts?: {
    model?: "tts-1" | "tts-1-hd" | "gpt-4o-mini-tts";
    voiceStyle?: "default" | "conversation";
  },
): Promise<void> {
  const voiceChatTts =
    fetchOpts?.model === "gpt-4o-mini-tts" && fetchOpts?.voiceStyle === "conversation";

  let blob: Blob;
  if (voiceChatTts) {
    try {
      blob = await fetchOpenAiTtsBlob(text, voiceGender, fetchOpts);
    } catch {
      try {
        blob = await fetchOpenAiTtsBlob(text, voiceGender, {
          model: "tts-1-hd",
          voiceStyle: "conversation",
        });
      } catch {
        blob = await fetchOpenAiTtsBlob(text, voiceGender, {
          model: "tts-1",
          voiceStyle: "conversation",
        });
      }
    }
  } else {
    blob = await fetchOpenAiTtsBlob(text, voiceGender, fetchOpts);
  }

  /* One output path: cancel browser TTS so OpenAI MP3 never overlaps a different engine/voice. */
  stopSpeaking();

  /* APK / WebView without `speechSynthesis`: Web Audio analyser path is flaky — simple `<audio>` MP3 only. */
  const useSimplePlayback = isNativeCapacitor() || !isSpeechSynthesisSupported();
  if (useSimplePlayback) {
    await playMp3BlobSimpleWithSyntheticMouth(blob, mouthShapeRef);
    return;
  }

  try {
    await playMp3BlobWithLipSync(blob, mouthShapeRef);
  } catch {
    await playMp3BlobSimpleWithSyntheticMouth(blob, mouthShapeRef);
  }
}

/** Server OpenAI MP3 only — no lip-sync (e.g. Profile Hello Neo). Returns false if fetch/play fails. */
export async function tryPlayOpenAiTtsPlain(
  text: string,
  voiceGender?: TtsVoiceGender,
): Promise<boolean> {
  try {
    const blob = await fetchOpenAiTtsBlob(text, voiceGender, { model: "tts-1-hd" });
    await playMp3BlobSimple(blob);
    return true;
  } catch {
    return false;
  }
}

export type SpeakWithAvatarLipSyncOpts = {
  voiceGender?: TtsVoiceGender;
  speedPreset?: TtsSpeedPreset;
  tonePreset?: TtsTonePreset;
  replyMood?: VoiceReplyMood;
  mouthShapeRef: { current: KalidokitMouthShape };
  /** If true, use OpenAI MP3 + Web Audio lip sync (optional). Default: browser TTS only (same as before). */
  preferOpenAiTts?: boolean;
  /**
   * Voice chat page only: OpenAI `gpt-4o-mini-tts` + marin/cedar + style instructions (natural pacing); browser path gets calmer delivery.
   */
  voiceChatOpenAiTts?: boolean;
};

/** Voice chat: stream assistant tokens → speak phrase-sized chunks without waiting for the full reply. */
export type VoiceChatStreamedOpenAiTtsSession = {
  pushAssistantDelta(delta: string): void;
  /** Speak any remaining buffered text and await all queued audio. */
  finish(): Promise<void>;
  /** Stop timers and playback (e.g. abort / interrupt). */
  dispose(): void;
};

/**
 * OpenAI TTS chunks in order as SSE text arrives — first audible phrase usually starts shortly after
 * a natural break (sentence / clause / word boundary) plus one TTS round-trip.
 */
export function createVoiceChatStreamedOpenAiTtsSession(opts: {
  mouthShapeRef: { current: KalidokitMouthShape };
  voiceGender: TtsVoiceGender | undefined;
  /** When the first speakable chunk is queued (before audio returns) — e.g. clear “thinking” UI. */
  onFirstSpeakableChunk?: () => void;
  /** If set, skip further playback when this no longer matches (user interrupted). */
  speakGenerationRef?: { current: number };
  speakGenerationId: number;
  signal?: AbortSignal;
}): VoiceChatStreamedOpenAiTtsSession {
  let buf = "";
  let spoken = 0;
  let disposed = false;
  let firstChunkQueued = false;
  let chain: Promise<void> = Promise.resolve();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const fetchOpts = { model: "gpt-4o-mini-tts" as const, voiceStyle: "conversation" as const };

  const genOk = () =>
    !disposed &&
    !opts.signal?.aborted &&
    (opts.speakGenerationRef == null || opts.speakGenerationRef.current === opts.speakGenerationId);

  const findNextFlushEnd = (full: string, from: number, isFirst: boolean): number => {
    const n = full.length;
    const minLen = isFirst ? 8 : 18;
    if (n - from < minLen) return -1;
    const hardMax = 140;
    const searchTo = Math.min(n, from + hardMax);
    for (let i = from + minLen; i < searchTo; i++) {
      const c = full[i];
      if (c === "." || c === "!" || c === "?" || c === "\n" || c === "\u0964") {
        return i + 1;
      }
    }
    for (let i = from + minLen; i < searchTo; i++) {
      const ch = full[i];
      if (",;:-".includes(ch) && i - from >= 20) {
        return i + 1;
      }
    }
    if (n - from >= hardMax) {
      const slice = full.slice(from, from + hardMax);
      const sp = slice.lastIndexOf(" ");
      if (sp >= minLen - 1) return from + sp + 1;
    }
    return -1;
  };

  const tryFlushHardBoundaries = () => {
    let isFirst = spoken === 0;
    while (genOk()) {
      const end = findNextFlushEnd(buf, spoken, isFirst);
      if (end < 0) break;
      const raw = buf.slice(spoken, end);
      spoken = end;
      isFirst = false;
      const t = prepareSpeechText(raw, 520).trim();
      if (!t) continue;
      if (!firstChunkQueued) {
        firstChunkQueued = true;
        opts.onFirstSpeakableChunk?.();
      }
      const g = opts.speakGenerationId;
      chain = chain.then(async () => {
        if (!genOk() || opts.speakGenerationRef?.current !== g) return;
        await tryOpenAiTts(t, opts.mouthShapeRef, opts.voiceGender, fetchOpts);
      });
    }
  };

  const tryFlushIdlePartial = () => {
    if (!genOk() || buf.length - spoken < 16) return;
    const slice = buf.slice(spoken);
    const sp = slice.lastIndexOf(" ");
    if (sp < 10) return;
    const cut = spoken + sp + 1;
    const raw = buf.slice(spoken, cut);
    spoken = cut;
    const t = prepareSpeechText(raw, 520).trim();
    if (!t) return;
    if (!firstChunkQueued) {
      firstChunkQueued = true;
      opts.onFirstSpeakableChunk?.();
    }
    const g = opts.speakGenerationId;
    chain = chain.then(async () => {
      if (!genOk() || opts.speakGenerationRef?.current !== g) return;
      await tryOpenAiTts(t, opts.mouthShapeRef, opts.voiceGender, fetchOpts);
    });
  };

  const scheduleIdleFlush = () => {
    if (idleTimer != null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (!genOk()) return;
      tryFlushHardBoundaries();
      tryFlushIdlePartial();
    }, 165);
  };

  const flushRemainder = () => {
    const tail = buf.slice(spoken).trim();
    spoken = buf.length;
    if (!tail) return;
    const t = prepareSpeechText(tail, 520).trim();
    if (!t) return;
    if (!firstChunkQueued) {
      firstChunkQueued = true;
      opts.onFirstSpeakableChunk?.();
    }
    const g = opts.speakGenerationId;
    chain = chain.then(async () => {
      if (!genOk() || opts.speakGenerationRef?.current !== g) return;
      await tryOpenAiTts(t, opts.mouthShapeRef, opts.voiceGender, fetchOpts);
    });
  };

  return {
    pushAssistantDelta(delta: string) {
      if (!genOk() || !delta) return;
      buf += delta;
      tryFlushHardBoundaries();
      scheduleIdleFlush();
    },
    async finish() {
      if (idleTimer != null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (!genOk()) return;
      tryFlushHardBoundaries();
      tryFlushIdlePartial();
      flushRemainder();
      await chain;
    },
    dispose() {
      disposed = true;
      if (idleTimer != null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      stopAvatarTtsAudio();
    },
  };
}

/**
 * Browser `speakText` + synthetic mouth by default. Set `preferOpenAiTts: true` for OpenAI TTS + analyser lip sync.
 */
export async function speakTextWithAvatarLipSync(
  text: string,
  lang: string,
  opts: SpeakWithAvatarLipSyncOpts,
): Promise<void> {
  const prefer = opts.preferOpenAiTts === true;
  const voiceChat = opts.voiceChatOpenAiTts === true;
  const ref = opts.mouthShapeRef;

  if (prefer) {
    try {
      await tryOpenAiTts(
        text,
        ref,
        opts.voiceGender,
        voiceChat
          ? { model: "gpt-4o-mini-tts", voiceStyle: "conversation" }
          : { model: "tts-1-hd", voiceStyle: "default" },
      );
      return;
    } catch (e) {
      /* No browser TTS fallback possible — surface fetch/play errors (e.g. APK WebView). */
      if (isNativeCapacitor() || !isSpeechSynthesisSupported()) {
        throw e instanceof Error ? e : new Error(String(e));
      }
      /* Desktop browser: optional Web Speech fallback below */
    }
  }

  stopRafLoop();
  stopAvatarTtsAudio();

  await new Promise<void>((resolve, reject) => {
    let rafId = 0;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      const t = performance.now() * 0.001;
      ref.current = syntheticMouthShapeFromTime(t);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    const finish = (err?: unknown) => {
      stopped = true;
      cancelAnimationFrame(rafId);
      ref.current = { ...EMPTY_MOUTH_SHAPE };
      if (err !== undefined)
        reject(err instanceof Error ? err : new Error(String(err)));
      else resolve();
    };

    speakText(text, lang, {
      voiceGender: opts.voiceGender,
      speedPreset: opts.speedPreset,
      tonePreset: opts.tonePreset,
      replyMood: opts.replyMood,
      voiceChatCalmDelivery: voiceChat,
    })
      .then(() => finish())
      .catch((e) => finish(e));
  });
}
