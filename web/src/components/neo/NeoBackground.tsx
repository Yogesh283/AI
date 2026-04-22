"use client";

import { NeoWaterSurface } from "@/components/neo/NeoWaterSurface";

/**
 * Layer order (back → front): sky aurora (slow breathe) → horizon → water waves + mesh
 * (horizontal flow) → stars. Sky motion is intentionally NOT the same as water motion.
 */
export function NeoBackground({ stars = 48 }: { stars?: number }) {
  return (
    <>
      {/* Sky: soft glow only — no drifting “liquid” paths */}
      <div className="neo-aurora-waves" aria-hidden>
        <div className="neo-aurora-wave neo-aurora-wave--a" />
        <div className="neo-aurora-wave neo-aurora-wave--b" />
        <div className="neo-aurora-wave neo-aurora-wave--c" />
      </div>
      <div className="neo-horizon-glow" aria-hidden />
      {/* Water zone: SVG waves + dot mesh slide horizontally — unlike sky */}
      <div className="neo-water-zone" aria-hidden>
        <NeoWaterSurface />
        <div className="neo-mesh-terrain" />
      </div>
      <div className="neo-starfield" aria-hidden>
        {Array.from({ length: stars }).map((_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 10) * 0.4}s`,
            }}
          />
        ))}
      </div>
      <div className="neo-bottom-wave" aria-hidden />
    </>
  );
}
