/**
 * TTS for voice + 3D avatar: Kalidokit-style mouth shapes via ref.
 * - Prefer OpenAI MP3 (`/api/voice/tts-audio`) + Web Audio analyser → realistic lip sync.
 * - Fallback: Web Speech API + synthetic mouth shapes (no audio buffer).
 */

import { apiOrigin } from "@/lib/apiBase";
import { isNativeCapacitor } from "@/lib/nativeAppLinks";
import {
  isSpeechSynthesisSupported,
  speakText,
  type TtsVoiceGender,
  type TtsSpeedPreset,
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
      cleanupAudioGraph();
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      stopRafLoop();
      mouthShapeRef.current = { ...EMPTY_MOUTH_SHAPE };
      cleanupAudioGraph();
      URL.revokeObjectURL(url);
      reject(new Error("Audio playback error"));
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

function openAiTtsVoiceId(gender?: TtsVoiceGender): string {
  return gender === "male" ? "onyx" : "nova";
}

async function fetchOpenAiTtsBlob(
  text: string,
  voiceGender?: TtsVoiceGender,
): Promise<Blob> {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new Error("TTS: empty text");
  }

  const res = await fetch(`${apiOrigin()}/api/voice/tts-audio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      text: trimmed,
      voice: openAiTtsVoiceId(voiceGender),
      model: "tts-1",
    }),
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
  voiceGender?: TtsVoiceGender,
): Promise<void> {
  const blob = await fetchOpenAiTtsBlob(text, voiceGender);

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
    const blob = await fetchOpenAiTtsBlob(text, voiceGender);
    await playMp3BlobSimple(blob);
    return true;
  } catch {
    return false;
  }
}

export type SpeakWithAvatarLipSyncOpts = {
  voiceGender?: TtsVoiceGender;
  speedPreset?: TtsSpeedPreset;
  replyMood?: VoiceReplyMood;
  mouthShapeRef: { current: KalidokitMouthShape };
  /** If true, use OpenAI MP3 + Web Audio lip sync (optional). Default: browser TTS only (same as before). */
  preferOpenAiTts?: boolean;
};

/**
 * Browser `speakText` + synthetic mouth by default. Set `preferOpenAiTts: true` for OpenAI TTS + analyser lip sync.
 */
export async function speakTextWithAvatarLipSync(
  text: string,
  lang: string,
  opts: SpeakWithAvatarLipSyncOpts,
): Promise<void> {
  const prefer = opts.preferOpenAiTts === true;
  const ref = opts.mouthShapeRef;

  if (prefer) {
    try {
      await tryOpenAiTts(text, ref, opts.voiceGender);
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
      replyMood: opts.replyMood,
    })
      .then(() => finish())
      .catch((e) => finish(e));
  });
}
