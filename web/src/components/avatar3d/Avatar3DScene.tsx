"use client";

import { useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import type { AvatarEmotion } from "@/lib/vrmEmotion";
import type { KalidokitMouthShape } from "@/lib/vrmKalidokitMouth";
import type { VoicePersonaVrmId } from "@/lib/vrmPersonaModelUrl";
import { resolveVrmModelUrlForPersona } from "@/lib/vrmPersonaModelUrl";
import { getEmotionBodySway } from "@/lib/vrmEmotionPerformance";
import { VrmAvatar } from "@/components/avatar3d/VrmAvatar";

/** Woman — saree / bindi — fallback when VRM is unavailable */
function FemaleSpeakingAvatar({ speaking, emotion }: { speaking: boolean; emotion: AvatarEmotion }) {
  const group = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const emotionRef = useRef(emotion);
  emotionRef.current = emotion;

  useFrame(() => {
    if (!group.current) return;
    const tSec = performance.now() * 0.001;
    const { rotY, rotX, rotZ } = getEmotionBodySway(emotionRef.current, speaking, tSec);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, rotY * 1.35, 0.14);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, rotX * 1.2, 0.12);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, rotZ * 1.2, 0.12);
    if (speaking && head.current) {
      const w = 1 + Math.abs(Math.sin(tSec * 14)) * 0.05;
      head.current.scale.setScalar(w);
    } else if (head.current) {
      head.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
  });

  const skin = "#c9a088";
  const hair = "#1a1512";
  const saree = "#141418";
  const blouse = "#f5f0ea";
  const gold = "#c9a227";

  return (
    <group ref={group} position={[0, -0.52, 0]} scale={1.42}>
      {/* Saree / lower torso */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <capsuleGeometry args={[0.34, 1.12, 8, 24]} />
        <meshStandardMaterial color={saree} metalness={0.12} roughness={0.72} />
      </mesh>
      {/* Saree border hint */}
      <mesh position={[0.36, 0.42, 0.02]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[0.06, 0.85, 0.02]} />
        <meshStandardMaterial color={gold} metalness={0.55} roughness={0.35} />
      </mesh>
      {/* Blouse */}
      <mesh position={[0, 1.38, 0.02]} castShadow>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial color={blouse} metalness={0.08} roughness={0.65} />
      </mesh>
      {/* Head / face */}
      <mesh ref={head} position={[0, 1.72, 0.06]} castShadow>
        <sphereGeometry args={[0.34, 40, 40]} />
        <meshStandardMaterial color={skin} metalness={0.06} roughness={0.62} />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 1.86, -0.06]} castShadow>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshStandardMaterial color={hair} metalness={0.18} roughness={0.85} />
      </mesh>
      {/* Bindi */}
      <mesh position={[0, 1.78, 0.34]}>
        <circleGeometry args={[0.028, 16]} />
        <meshStandardMaterial color="#c41e3a" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Subtle mouth motion cue when speaking */}
      <mesh position={[0, 1.62, 0.33]}>
        <boxGeometry args={[0.12, speaking ? 0.05 : 0.02, 0.02]} />
        <meshStandardMaterial color="#8b5348" roughness={0.55} />
      </mesh>
    </group>
  );
}

/** Man — jacket / collar — distinct from woman fallback */
function MaleSpeakingAvatar({ speaking, emotion }: { speaking: boolean; emotion: AvatarEmotion }) {
  const group = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const emotionRef = useRef(emotion);
  emotionRef.current = emotion;

  useFrame(() => {
    if (!group.current) return;
    const tSec = performance.now() * 0.001;
    const { rotY, rotX, rotZ } = getEmotionBodySway(emotionRef.current, speaking, tSec);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, rotY * 1.35, 0.14);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, rotX * 1.2, 0.12);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, rotZ * 1.2, 0.12);
    if (speaking && head.current) {
      const w = 1 + Math.abs(Math.sin(tSec * 14)) * 0.045;
      head.current.scale.setScalar(w);
    } else if (head.current) {
      head.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
  });

  const skin = "#c4a088";
  const hair = "#0d0d0f";
  const jacket = "#2a3548";
  const shirt = "#e8eef5";

  return (
    <group ref={group} position={[0, -0.52, 0]} scale={1.42}>
      <mesh position={[0, 0.88, 0]} castShadow>
        <capsuleGeometry args={[0.36, 1.12, 8, 24]} />
        <meshStandardMaterial color={jacket} metalness={0.22} roughness={0.58} />
      </mesh>
      <mesh position={[0, 1.42, 0.05]} castShadow>
        <boxGeometry args={[0.52, 0.22, 0.28]} />
        <meshStandardMaterial color={shirt} metalness={0.06} roughness={0.7} />
      </mesh>
      <mesh ref={head} position={[0, 1.72, 0.06]} castShadow>
        <sphereGeometry args={[0.35, 40, 40]} />
        <meshStandardMaterial color={skin} metalness={0.06} roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.88, -0.05]} castShadow>
        <boxGeometry args={[0.4, 0.14, 0.36]} />
        <meshStandardMaterial color={hair} metalness={0.15} roughness={0.88} />
      </mesh>
      <mesh position={[0, 1.62, 0.33]}>
        <boxGeometry args={[0.13, speaking ? 0.05 : 0.02, 0.02]} />
        <meshStandardMaterial color="#8b5348" roughness={0.55} />
      </mesh>
    </group>
  );
}

type Avatar3DSceneProps = {
  speaking: boolean;
  emotion: AvatarEmotion;
  mouthShapeRef?: MutableRefObject<KalidokitMouthShape>;
  /** Man (arjun) vs Woman (sara) — different VRM URL + fallback bust */
  voicePersonaId: VoicePersonaVrmId;
};

function Avatar3DSceneContent({
  speaking,
  emotion,
  mouthShapeRef,
  voicePersonaId,
}: Avatar3DSceneProps) {
  const [vrmReady, setVrmReady] = useState(false);
  const [vrmFailed, setVrmFailed] = useState(false);
  const modelUrl = resolveVrmModelUrlForPersona(voicePersonaId);
  const skipVrm = modelUrl == null || modelUrl === "";
  const showPrimitive = skipVrm || vrmFailed || !vrmReady;

  return (
    <>
      <color attach="background" args={["#0a0908"]} />
      <fog attach="fog" args={["#0c0a09", 2.2, 11]} />

      {/* Portrait studio: warm key + cool fill + warm rim */}
      <ambientLight intensity={0.28} color="#ffe8d4" />
      <directionalLight
        position={[2.8, 3.6, 4.2]}
        intensity={1.42}
        color="#fff6ed"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[-3.8, 2.2, 1.8]} intensity={0.32} color="#c8d4f0" />
      <directionalLight position={[0.2, 2.4, -3.6]} intensity={0.38} color="#ffd6b8" />
      <pointLight position={[1.2, 1.9, 2.1]} intensity={0.35} color="#ffe4cc" distance={8} decay={2} />

      {!skipVrm && !vrmFailed && modelUrl ? (
        <VrmAvatar
          key={`${voicePersonaId}-${modelUrl}`}
          modelUrl={modelUrl}
          speaking={speaking}
          emotion={emotion}
          mouthShapeRef={mouthShapeRef}
          onLoaded={() => setVrmReady(true)}
          onLoadFailed={() => setVrmFailed(true)}
        />
      ) : null}
      {showPrimitive ? (
        voicePersonaId === "arjun" ? (
          <MaleSpeakingAvatar speaking={speaking} emotion={emotion} />
        ) : (
          <FemaleSpeakingAvatar speaking={speaking} emotion={emotion} />
        )
      ) : null}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#060504" metalness={0.05} roughness={0.98} />
      </mesh>
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.55}
        scale={12}
        blur={2.2}
        far={4.5}
        color="#000000"
      />
      <OrbitControls
        enablePan={false}
        minPolarAngle={0.62}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={1.05}
        maxDistance={4.2}
        target={[0, 1.28, 0]}
        enableDamping
        dampingFactor={0.06}
      />
    </>
  );
}

export function Avatar3DScene(props: Avatar3DSceneProps) {
  return <Avatar3DSceneContent key={props.voicePersonaId} {...props} />;
}
