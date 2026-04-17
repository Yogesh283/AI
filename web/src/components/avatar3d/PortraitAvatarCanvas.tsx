"use client";

import type { MutableRefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { Avatar3DScene } from "@/components/avatar3d/Avatar3DScene";
import type { AvatarEmotion } from "@/lib/vrmEmotion";
import type { KalidokitMouthShape } from "@/lib/vrmKalidokitMouth";
import type { VoicePersonaVrmId } from "@/lib/vrmPersonaModelUrl";

type PortraitAvatarCanvasProps = {
  speaking: boolean;
  emotion: AvatarEmotion;
  voicePersonaId: VoicePersonaVrmId;
  /** Kalidokit A/E/I/O/U (from `voiceAvatarTts` + Web Audio or synthetic). */
  mouthShapeRef?: MutableRefObject<KalidokitMouthShape>;
  className?: string;
  /** Tailwind height classes for the viewport, e.g. `h-[min(68vh,600px)]` */
  heightClassName?: string;
  showSpeakingBadge?: boolean;
};

export function PortraitAvatarCanvas({
  speaking,
  emotion,
  voicePersonaId,
  mouthShapeRef,
  className = "",
  heightClassName = "h-[min(68vh,600px)]",
  showSpeakingBadge = true,
}: PortraitAvatarCanvasProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0807] shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.04] ${heightClassName} ${className}`}
    >
      <Canvas
        className="relative z-[1] block h-full w-full"
        shadows
        camera={{ position: [0, 1.32, 1.42], fov: 36 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Avatar3DScene
          speaking={speaking}
          emotion={emotion}
          mouthShapeRef={mouthShapeRef}
          voicePersonaId={voicePersonaId}
        />
      </Canvas>
      <div
        className="pointer-events-none absolute inset-0 z-[2] rounded-[inherit] bg-[radial-gradient(ellipse_72%_58%_at_50%_38%,transparent_0%,rgba(8,6,5,0.35)_55%,rgba(0,0,0,0.65)_100%)]"
        aria-hidden
      />
      {showSpeakingBadge && speaking ? (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[3] -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300/95">
          Speaking
        </div>
      ) : null}
    </div>
  );
}
