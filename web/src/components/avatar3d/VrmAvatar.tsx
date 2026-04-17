"use client";

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRM, VRMUtils, VRMLoaderPlugin } from "@pixiv/three-vrm";
import type { VRMExpressionManager } from "@pixiv/three-vrm-core";
import type { AvatarEmotion } from "@/lib/vrmEmotion";
import {
  applyKalidokitMouthToVrm,
  resetMouthVisemes,
  type KalidokitMouthShape,
} from "@/lib/vrmKalidokitMouth";
import {
  blinkWeightIdle,
  buildEmotionExpressionTargets,
  getEmotionBodySway,
} from "@/lib/vrmEmotionPerformance";
import { applyVrmRelaxedArmsPose } from "@/lib/vrmRelaxedArmsPose";

function safeSetExpression(em: VRMExpressionManager, name: string, weight: number): void {
  if (!em.getExpression(name)) return;
  em.setValue(name, THREE.MathUtils.clamp(weight, 0, 1));
}

/** Legacy sine lip sync when no Kalidokit ref (fallback). */
function applySyntheticLipSync(em: VRMExpressionManager, t: number): void {
  const wave = 0.5 + 0.5 * Math.sin(t * 13.5);
  const w2 = 0.5 + 0.5 * Math.sin(t * 8.7 + 1.1);
  const mouth = 0.42 + 0.38 * wave;

  safeSetExpression(em, "aa", mouth);
  safeSetExpression(em, "ih", 0.28 * w2);
  safeSetExpression(em, "ee", 0.22 * (1 - wave));
  safeSetExpression(em, "oh", 0.18 * Math.abs(Math.sin(t * 10.8)));
  safeSetExpression(em, "ou", 0.12 * Math.abs(Math.sin(t * 7.2 + 0.5)));
}

type VrmExpressionDriverProps = {
  vrm: VRM;
  speaking: boolean;
  emotion: AvatarEmotion;
  mouthShapeRef?: MutableRefObject<KalidokitMouthShape>;
};

function VrmExpressionDriver({ vrm, speaking, emotion, mouthShapeRef }: VrmExpressionDriverProps) {
  const emotionRef = useRef(emotion);
  const speakingRef = useRef(speaking);
  const mouthRef = mouthShapeRef;
  emotionRef.current = emotion;
  speakingRef.current = speaking;

  useFrame((_, delta) => {
    const em = vrm.expressionManager;
    if (em) {
      const dt = Math.min(delta, 0.05);
      const smooth = 1 - Math.exp(-10 * dt);

      const targetEmotion = emotionRef.current;
      const targetWeights = buildEmotionExpressionTargets(targetEmotion);

      for (const name of Object.keys(targetWeights)) {
        const expr = em.getExpression(name);
        if (!expr) continue;
        const cur = em.getValue(name) ?? 0;
        const tgt = targetWeights[name] ?? 0;
        em.setValue(name, THREE.MathUtils.lerp(cur, tgt, smooth));
      }

      const talk = speakingRef.current;
      if (talk) {
        safeSetExpression(em, "blink", 0);
        if (mouthRef) {
          applyKalidokitMouthToVrm(em, mouthRef.current);
        } else {
          const t = performance.now() * 0.001;
          applySyntheticLipSync(em, t);
        }
      } else {
        resetMouthVisemes(em);
        const t = performance.now() * 0.001;
        safeSetExpression(em, "blink", blinkWeightIdle(t));
      }
    }

    vrm.update(delta);
    applyVrmRelaxedArmsPose(vrm);
  });

  return <primitive object={vrm.scene} />;
}

function EmotionBodySway({
  speaking,
  emotion,
  children,
}: {
  speaking: boolean;
  emotion: AvatarEmotion;
  children: ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  const emotionRef = useRef(emotion);
  emotionRef.current = emotion;

  useFrame(() => {
    if (!g.current) return;
    const t = performance.now() * 0.001;
    const { rotY, rotX, rotZ } = getEmotionBodySway(emotionRef.current, speaking, t);
    g.current.rotation.y = THREE.MathUtils.lerp(g.current.rotation.y, rotY, 0.14);
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, rotX, 0.12);
    g.current.rotation.z = THREE.MathUtils.lerp(g.current.rotation.z, rotZ, 0.12);
  });
  return <group ref={g}>{children}</group>;
}

export function VrmAvatar({
  modelUrl,
  speaking,
  emotion,
  mouthShapeRef,
  onLoaded,
  onLoadFailed,
}: {
  /** Loaded VRM — use `resolveVrmModelUrlForPersona` on voice page for Man/Woman. */
  modelUrl: string;
  speaking: boolean;
  emotion: AvatarEmotion;
  /** Kalidokit A/E/I/O/U weights from audio or synthetic driver (voice page). */
  mouthShapeRef?: MutableRefObject<KalidokitMouthShape>;
  onLoaded?: () => void;
  onLoadFailed?: () => void;
}) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const loadedRef = useRef<VRM | null>(null);
  const onLoadedRef = useRef(onLoaded);
  const onFailedRef = useRef(onLoadFailed);
  onLoadedRef.current = onLoaded;
  onFailedRef.current = onLoadFailed;

  useEffect(() => {
    const url = modelUrl;
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf) => {
        if (cancelled) {
          const v = gltf.userData.vrm as VRM | undefined;
          if (v) VRMUtils.deepDispose(v.scene);
          return;
        }
        const loaded = gltf.userData.vrm as VRM;
        if (loaded.meta?.metaVersion === "0") {
          VRMUtils.rotateVRM0(loaded);
        }
        loadedRef.current = loaded;
        setVrm(loaded);
        onLoadedRef.current?.();
      },
      undefined,
      () => {
        if (!cancelled) onFailedRef.current?.();
      },
    );

    return () => {
      cancelled = true;
      const current = loadedRef.current;
      loadedRef.current = null;
      setVrm(null);
      if (current) {
        VRMUtils.deepDispose(current.scene);
      }
    };
  }, [modelUrl]);

  if (!vrm) return null;

  return (
    <group position={[0, -0.68, 0]} scale={1.52}>
      <EmotionBodySway speaking={speaking} emotion={emotion}>
        <VrmExpressionDriver
          vrm={vrm}
          speaking={speaking}
          emotion={emotion}
          mouthShapeRef={mouthShapeRef}
        />
      </EmotionBodySway>
    </group>
  );
}
