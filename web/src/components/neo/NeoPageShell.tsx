"use client";

import type { ReactNode } from "react";
import { MainTopNav } from "@/components/neo/MainTopNav";

export type NeoPageMaxWidth = "narrow" | "content" | "wide" | "full";

const MAX_W: Record<NeoPageMaxWidth, string> = {
  narrow: "max-w-lg",
  content: "max-w-3xl",
  wide: "max-w-5xl",
  full: "max-w-none",
};

export type NeoPageShellProps = {
  children: ReactNode;
  /** Optional label in the top bar */
  navCenter?: ReactNode;
  maxWidth?: NeoPageMaxWidth;
  innerClassName?: string;
  contentClassName?: string;
  /**
   * Horizontal padding on the scroll area. Set false for full-bleed canvases (e.g. dashboard grid).
   * Default matches FAQ / Terms / Create.
   */
  padded?: boolean;
};

/**
 * Shared chrome: background, dot texture, {@link MainTopNav} fixed at top of the column while only the
 * body scrolls (same pattern as chat/profile — reliable on mobile WebViews; `sticky` alone often fails).
 */
export function NeoPageShell({
  children,
  navCenter,
  maxWidth = "content",
  innerClassName,
  contentClassName,
  padded = true,
}: NeoPageShellProps) {
  const pad = padded ? "px-4 sm:px-6" : "";
  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#F5F7FA]">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:10px_10px]"
        aria-hidden
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        <MainTopNav center={navCenter} />
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth [touch-action:pan-y] [-webkit-overflow-scrolling:touch] pt-6 max-md:pb-6 md:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] ${pad} ${contentClassName ?? ""}`}
        >
          <div className={`mx-auto w-full ${MAX_W[maxWidth]} ${innerClassName ?? ""}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
