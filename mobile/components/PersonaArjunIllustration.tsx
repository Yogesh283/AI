import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/** Matches `web/public/avatars/persona-arjun.svg` — male voice persona art. */
export function PersonaArjunIllustration() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ flex: 1 }}
    >
      <Defs>
        <LinearGradient id="arjunBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#0c4a6e" />
          <Stop offset="100%" stopColor="#020617" />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} fill="url(#arjunBg)" rx={12} />
      <Ellipse cx={50} cy={82} rx={18} ry={12} fill="#b8957a" />
      <Ellipse cx={50} cy={42} rx={32} ry={36} fill="#d4a574" />
      <Path
        d="M18 38 Q50 6 82 38 Q80 22 50 14 Q20 22 18 38"
        fill="#1c1917"
      />
      <Ellipse cx={37} cy={40} rx={5} ry={6} fill="#1e293b" />
      <Ellipse cx={63} cy={40} rx={5} ry={6} fill="#1e293b" />
      <Path
        d="M36 54 Q50 64 64 54"
        stroke="#92400e"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}
