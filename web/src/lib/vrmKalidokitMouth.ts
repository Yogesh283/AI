import * as THREE from "three";
import type { VRMExpressionManager } from "@pixiv/three-vrm-core";
import type { TFace } from "kalidokit";

/**
 * Kalidokit `Face.solve()` mouth.shape (A/E/I/O/U) — same letter mapping as VRM viseme presets.
 * @see https://github.com/yeemachine/kalidokit — MediaPipe/TF landmarks → blendshapes
 */
export type KalidokitMouthShape = TFace["mouth"]["shape"];

export const EMPTY_MOUTH_SHAPE: KalidokitMouthShape = {
  A: 0,
  E: 0,
  I: 0,
  O: 0,
  U: 0,
};

export function clampMouthShape(s: KalidokitMouthShape): KalidokitMouthShape {
  const c = (x: number) => THREE.MathUtils.clamp(x, 0, 1);
  return { A: c(s.A), E: c(s.E), I: c(s.I), O: c(s.O), U: c(s.U) };
}

/** Apply Kalidokit vowel weights to VRM expression presets (aa / ee / ih / oh / ou). */
export function applyKalidokitMouthToVrm(em: VRMExpressionManager, shape: KalidokitMouthShape): void {
  const s = clampMouthShape(shape);
  const set = (name: string, w: number) => {
    if (!em.getExpression(name)) return;
    em.setValue(name, w);
  };
  set("aa", s.A);
  set("ee", s.E);
  set("ih", s.I);
  set("oh", s.O);
  set("ou", s.U);
}

/** Reset mouth visemes (when not speaking). */
export function resetMouthVisemes(em: VRMExpressionManager): void {
  for (const name of ["aa", "ee", "ih", "oh", "ou"]) {
    if (em.getExpression(name)) em.setValue(name, 0);
  }
}
