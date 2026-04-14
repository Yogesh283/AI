"use client";

import Link from "next/link";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { NeoBackground } from "@/components/neo/NeoBackground";
import { NeoLogoMark } from "@/components/neo/NeoLogoHead";

/**
 * ChatGPT-like public pages: top bar + centered column, NeoXAI theme.
 */
export function NeoPublicShell({
  children,
  maxWidth = "max-w-lg",
}: {
  children: React.ReactNode;
  maxWidth?: "max-w-lg" | "max-w-2xl" | "max-w-3xl" | "max-w-4xl";
}) {
  const { brandName } = useSiteBrand();

  return (
    <div className="relative z-[1] flex min-h-screen flex-col">
      <NeoBackground stars={20} />
      <header className="sticky top-0 z-50 flex h-auto min-h-14 shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] bg-[#0b0e14]/92 px-3 pt-[max(0.35rem,env(safe-area-inset-top,0px))] pb-2 backdrop-blur-xl sm:gap-3 sm:px-4 md:h-14 md:min-h-0 md:px-8 md:py-0 md:pt-0">
        <Link href="/" className="flex min-w-0 max-w-[58%] items-center gap-2 sm:max-w-[65%] sm:gap-2.5 md:max-w-none">
          <NeoLogoMark className="h-8 w-8 shrink-0 drop-shadow-[0_0_12px_rgba(0,212,255,0.25)] sm:h-9 sm:w-9" />
          <span className="truncate bg-gradient-to-r from-[#00D4FF] to-[#BD00FF] bg-clip-text text-base font-semibold tracking-tight text-transparent sm:text-lg">
            {brandName}
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2 text-xs sm:gap-3 sm:text-sm">
          <Link
            href="/login"
            className="whitespace-nowrap font-medium text-white/55 transition hover:text-white/90"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="whitespace-nowrap rounded-lg border border-white/[0.12] bg-white/[0.06] px-2.5 py-1.5 font-medium text-white/90 transition hover:bg-white/[0.1] sm:px-3.5"
          >
            Sign up
          </Link>
        </nav>
      </header>
      <div
        className={`relative z-[1] mx-auto flex w-full flex-1 flex-col px-4 py-8 pb-28 sm:px-5 sm:py-10 md:px-8 ${maxWidth}`}
      >
        {children}
      </div>
    </div>
  );
}
