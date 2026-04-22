"use client";

import type { ReactNode } from "react";

/** Fill paths (closed). Crest paths = top curve only — tile se lahar ki choti clearly chalti dikhe. */
const FILL_BACK =
  "M0,100 C240,72 480,118 720,92 C960,68 1180,108 1440,100 L1440,180 L0,180 Z";
const CREST_BACK =
  "M0,100 C240,72 480,118 720,92 C960,68 1180,108 1440,100";
const FILL_MID =
  "M0,88 C320,108 560,72 720,96 C920,122 1140,68 1440,88 L1440,160 L0,160 Z";
const CREST_MID =
  "M0,88 C320,108 560,72 720,96 C920,122 1140,68 1440,88";
const FILL_FRONT =
  "M0,76 C280,96 520,56 720,82 C940,108 1180,62 1440,76 L1440,140 L0,140 Z";
const CREST_FRONT =
  "M0,76 C280,96 520,56 720,82 C940,108 1180,62 1440,76";

function WaveChunk({
  fillPath,
  crestPath,
  gradId,
  stops,
}: {
  fillPath: string;
  crestPath: string;
  gradId: string;
  stops: ReactNode;
}) {
  return (
    <svg viewBox="0 0 1440 140" preserveAspectRatio="none" className="neo-water-wave-chunk">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          {stops}
        </linearGradient>
      </defs>
      <path fill={`url(#${gradId})`} d={fillPath} />
      <path
        fill="none"
        stroke="url(#neoCrestGlow)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="neo-wave-crest-line"
        d={crestPath}
      />
    </svg>
  );
}

export function NeoWaterSurface() {
  return (
    <div className="neo-water-surface" aria-hidden>
      <svg width="0" height="0" className="absolute overflow-hidden opacity-0" aria-hidden>
        <defs>
          <linearGradient id="neoCrestGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#6A5CFF" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#C85CFF" stopOpacity="0.9" />
          </linearGradient>
        </defs>
      </svg>

      <div className="neo-water-wave-layer neo-water-wave-layer--back">
        <div className="neo-lahar-roll neo-lahar-roll--back">
          <WaveChunk
            fillPath={FILL_BACK}
            crestPath={CREST_BACK}
            gradId="neoWaterGradA"
            stops={
              <>
                <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.24" />
                <stop offset="55%" stopColor="#6A5CFF" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#C85CFF" stopOpacity="0.2" />
              </>
            }
          />
          <WaveChunk
            fillPath={FILL_BACK}
            crestPath={CREST_BACK}
            gradId="neoWaterGradA2"
            stops={
              <>
                <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.24" />
                <stop offset="55%" stopColor="#6A5CFF" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#C85CFF" stopOpacity="0.2" />
              </>
            }
          />
        </div>
      </div>

      <div className="neo-water-wave-layer neo-water-wave-layer--mid">
        <div className="neo-lahar-roll neo-lahar-roll--mid">
          <WaveChunk
            fillPath={FILL_MID}
            crestPath={CREST_MID}
            gradId="neoWaterGradB"
            stops={
              <>
                <stop offset="0%" stopColor="#6A5CFF" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#00D4FF" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#C85CFF" stopOpacity="0.12" />
              </>
            }
          />
          <WaveChunk
            fillPath={FILL_MID}
            crestPath={CREST_MID}
            gradId="neoWaterGradB2"
            stops={
              <>
                <stop offset="0%" stopColor="#6A5CFF" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#00D4FF" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#C85CFF" stopOpacity="0.12" />
              </>
            }
          />
        </div>
      </div>

      <div className="neo-water-wave-layer neo-water-wave-layer--front">
        <div className="neo-lahar-roll neo-lahar-roll--front">
          <WaveChunk
            fillPath={FILL_FRONT}
            crestPath={CREST_FRONT}
            gradId="neoWaterGradC"
            stops={
              <>
                <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#C85CFF" stopOpacity="0.12" />
              </>
            }
          />
          <WaveChunk
            fillPath={FILL_FRONT}
            crestPath={CREST_FRONT}
            gradId="neoWaterGradC2"
            stops={
              <>
                <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#C85CFF" stopOpacity="0.12" />
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
