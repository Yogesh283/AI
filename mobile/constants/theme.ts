export const NEO = {
  bg: "#0B0E14",
  bgDeep: "#05070C",
  cyan: "#00D4FF",
  purple: "#9D50BB",
  magenta: "#BD00FF",
  text: "#F0F4FF",
  muted: "rgba(255,255,255,0.45)",
  glass: "rgba(16,22,38,0.88)",
  glassDeep: "rgba(10,14,24,0.94)",
  border: "rgba(255,255,255,0.09)",
  borderGlow: "rgba(0,212,255,0.18)",
  online: "#34d399",
} as const;

/** Primary CTA + hero accents — cyan → purple → magenta */
export const neoGradientPrimary = [
  NEO.cyan,
  NEO.purple,
  NEO.magenta,
] as const;

export const neoGradientScreen = [NEO.bg, "#080b12", NEO.bgDeep] as const;
