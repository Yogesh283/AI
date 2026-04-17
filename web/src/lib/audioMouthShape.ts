import type { KalidokitMouthShape } from "@/lib/vrmKalidokitMouth";
import { clampMouthShape, EMPTY_MOUTH_SHAPE } from "@/lib/vrmKalidokitMouth";

/**
 * Map Web Audio AnalyserNode frequency data → Kalidokit-style A/E/I/O/U weights
 * (audio-driven lip sync when TTS is PCM/MP3 via OpenAI or any playable buffer).
 */
export function mouthShapeFromFrequencyData(data: Uint8Array, timeSec: number): KalidokitMouthShape {
  if (data.length === 0) return { ...EMPTY_MOUTH_SHAPE };

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const rms = sum / (data.length * 255);

  const open = Math.min(1, rms * 4.2);
  const t = timeSec * 12;
  const wobble = 0.5 + 0.5 * Math.sin(t);
  const w2 = 0.5 + 0.5 * Math.sin(t * 0.87 + 1.1);

  return clampMouthShape({
    A: open * (0.55 + 0.35 * wobble),
    E: open * (0.35 + 0.25 * w2),
    I: open * (0.3 + 0.2 * Math.sin(t * 1.17)),
    O: open * (0.28 + 0.22 * Math.cos(t * 0.73)),
    U: open * 0.22,
  });
}

/** Browser SpeechSynthesis has no audio buffer — approximate Kalidokit-style shapes from time. */
export function syntheticMouthShapeFromTime(timeSec: number): KalidokitMouthShape {
  const wave = 0.5 + 0.5 * Math.sin(timeSec * 13.5);
  const w2 = 0.5 + 0.5 * Math.sin(timeSec * 8.7 + 1.1);
  const A = 0.28 + 0.42 * wave;
  return clampMouthShape({
    A,
    E: 0.12 + 0.28 * w2,
    I: 0.1 + 0.22 * (1 - wave),
    O: 0.08 + 0.18 * Math.abs(Math.sin(timeSec * 10.8)),
    U: 0.06 + 0.12 * Math.abs(Math.sin(timeSec * 7.2 + 0.5)),
  });
}
