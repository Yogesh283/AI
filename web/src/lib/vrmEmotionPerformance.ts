import type { AvatarEmotion } from "@/lib/vrmEmotion";

/**
 * Fine-tuned VRM expression weights per mood — not only lip-sync but face + subtle gaze cues.
 * Models without a preset simply skip (safeSetExpression in driver).
 */
export function buildEmotionExpressionTargets(emotion: AvatarEmotion): Record<string, number> {
  const o: Record<string, number> = {
    neutral: 0,
    happy: 0,
    sad: 0,
    angry: 0,
    surprised: 0,
    relaxed: 0,
    lookUp: 0,
    lookDown: 0,
    lookLeft: 0,
    lookRight: 0,
  };

  switch (emotion) {
    case "happy":
      o.happy = 0.58;
      o.relaxed = 0.42;
      o.surprised = 0.06;
      break;
    case "sad":
      o.sad = 0.72;
      o.relaxed = 0.12;
      o.lookDown = 0.22;
      break;
    case "angry":
      o.angry = 0.72;
      o.happy = 0;
      break;
    case "surprised":
      o.surprised = 0.78;
      o.lookUp = 0.14;
      break;
    default:
      o.neutral = 0.32;
      o.relaxed = 0.18;
      break;
  }
  return o;
}

/** Rhythmic sway + micro-tilt on the avatar root (whole body, no bone conflict). */
export function getEmotionBodySway(
  emotion: AvatarEmotion,
  speaking: boolean,
  tSec: number,
): { rotY: number; rotX: number; rotZ: number } {
  const baseFreq = speaking ? 2.05 : 0.55;
  const yawAmp = speaking ? (emotion === "happy" ? 0.048 : emotion === "angry" ? 0.035 : 0.038) : 0.014;
  const pitchAmp = speaking ? 0.018 : 0.008;
  const rollAmp =
    emotion === "sad" ? 0.022 : emotion === "happy" ? 0.012 : emotion === "surprised" ? 0.016 : 0.01;

  const rotY = Math.sin(tSec * baseFreq) * yawAmp + Math.sin(tSec * 0.7) * (speaking ? 0.012 : 0.006);
  const rotX = Math.sin(tSec * baseFreq * 0.5) * pitchAmp;
  const rotZ = Math.cos(tSec * (speaking ? 1.4 : 0.9)) * rollAmp * (emotion === "sad" ? -1 : 1);

  return { rotY, rotX, rotZ };
}

/** Periodic blink when idle (seconds) — weight 0..~0.85 */
export function blinkWeightIdle(tSec: number): number {
  const period = 3.1;
  const dur = 0.11;
  const p = tSec % period;
  if (p > dur) return 0;
  return Math.sin((p / dur) * Math.PI) * 0.82;
}
