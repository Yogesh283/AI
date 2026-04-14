import Image from "next/image";

const LOGO_SRC = "/neo-logo.png";
const INTRINSIC_W = 355;
const INTRINSIC_H = 355;

/** App mark — uses `public/neo-logo.png` (355×355). */
export function NeoLogoHead({
  className = "",
  priority = false,
}: {
  className?: string;
  /** LCP / above-the-fold splash hero */
  priority?: boolean;
}) {
  return (
    <Image
      src={LOGO_SRC}
      width={INTRINSIC_W}
      height={INTRINSIC_H}
      alt=""
      className={`object-contain ${className}`}
      priority={priority}
    />
  );
}

/** Compact mark for nav bars (same asset, CSS-sized). */
export function NeoLogoMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src={LOGO_SRC}
      width={INTRINSIC_W}
      height={INTRINSIC_H}
      alt=""
      className={`object-contain ${className}`}
    />
  );
}
