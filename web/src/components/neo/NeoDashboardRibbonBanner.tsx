"use client";

import type { ReactNode } from "react";

/**
 * Dashboard main column — three horizontal ribbon waves (teal / purple / magenta)
 * per reference art. Motion is horizontal scroll only; base stays grainy + static.
 */
const RIBBON_H = 42;

const TEAL_FILL =
  `M0,0 L1440,0 L1440,${RIBBON_H} C1200,${RIBBON_H + 10} 960,${RIBBON_H - 14} 720,${RIBBON_H} C480,${RIBBON_H + 8} 240,${RIBBON_H - 10} 0,${RIBBON_H} Z`;
const TEAL_CREST =
  `M0,${RIBBON_H} C240,${RIBBON_H - 10} 480,${RIBBON_H + 8} 720,${RIBBON_H} C960,${RIBBON_H - 12} 1200,${RIBBON_H + 6} 1440,${RIBBON_H}`;

const PURP_FILL =
  `M0,0 L1440,0 L1440,${RIBBON_H} C1080,${RIBBON_H + 12} 720,${RIBBON_H - 12} 360,${RIBBON_H} C240,${RIBBON_H + 6} 120,${RIBBON_H - 4} 0,${RIBBON_H} Z`;
const PURP_CREST =
  `M0,${RIBBON_H} C360,${RIBBON_H + 6} 720,${RIBBON_H - 8} 1080,${RIBBON_H} C1200,${RIBBON_H + 4} 1320,${RIBBON_H - 2} 1440,${RIBBON_H}`;

const MAG_FILL =
  `M0,0 L1440,0 L1440,${RIBBON_H} C960,${RIBBON_H + 8} 480,${RIBBON_H - 10} 0,${RIBBON_H} Z`;
const MAG_CREST =
  `M0,${RIBBON_H} C480,${RIBBON_H - 6} 960,${RIBBON_H + 10} 1440,${RIBBON_H}`;

function RibbonRow({
  fillPath,
  crestPath,
  fillId,
  fillStops,
  rollClass,
}: {
  fillPath: string;
  crestPath: string;
  fillId: string;
  fillStops: ReactNode;
  rollClass: string;
}) {
  return (
    <div className="neo-dash-ribbon-row">
      <div className={`neo-dash-ribbon-roll ${rollClass}`}>
        {[0, 1].map((i) => (
          <svg
            key={i}
            viewBox={`0 0 1440 ${RIBBON_H + 14}`}
            preserveAspectRatio="none"
            className="neo-dash-ribbon-chunk"
          >
            <defs>
              <linearGradient id={`${fillId}-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                {fillStops}
              </linearGradient>
              <linearGradient id={`${fillId}-crest-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.32" />
              </linearGradient>
            </defs>
            <path fill={`url(#${fillId}-${i})`} d={fillPath} />
            <path
              fill="none"
              stroke={`url(#${fillId}-crest-${i})`}
              strokeWidth="1.25"
              strokeLinecap="round"
              className="neo-dash-ribbon-crest"
              d={crestPath}
            />
          </svg>
        ))}
      </div>
    </div>
  );
}

export function NeoDashboardRibbonBanner() {
  return (
    <div className="neo-dash-ribbon-banner" aria-hidden>
      <RibbonRow
        fillPath={TEAL_FILL}
        crestPath={TEAL_CREST}
        fillId="neoDashTeal"
        rollClass="neo-dash-ribbon-roll--teal"
        fillStops={
          <>
            <stop offset="0%" stopColor="#00ced1" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#00a8aa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00ced1" stopOpacity="0.45" />
          </>
        }
      />
      <RibbonRow
        fillPath={PURP_FILL}
        crestPath={PURP_CREST}
        fillId="neoDashPurp"
        rollClass="neo-dash-ribbon-roll--purp"
        fillStops={
          <>
            <stop offset="0%" stopColor="#8a2be2" stopOpacity="0.42" />
            <stop offset="55%" stopColor="#5b1fa8" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#8a2be2" stopOpacity="0.38" />
          </>
        }
      />
      <RibbonRow
        fillPath={MAG_FILL}
        crestPath={MAG_CREST}
        fillId="neoDashMag"
        rollClass="neo-dash-ribbon-roll--mag"
        fillStops={
          <>
            <stop offset="0%" stopColor="#ff00ff" stopOpacity="0.28" />
            <stop offset="50%" stopColor="#c800c8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ff44ff" stopOpacity="0.26" />
          </>
        }
      />
    </div>
  );
}
