"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { NeoBottomDock } from "@/components/neo/NeoBottomDock";
import { NeoLogoMark } from "@/components/neo/NeoLogoHead";
import { getStoredToken } from "@/lib/auth";

/**
 * Public pages: light neumorphic shell, black text on white/off-white.
 */
export function NeoPublicShell({
  children,
  maxWidth = "max-w-lg",
  leadingBack,
}: {
  children: React.ReactNode;
  maxWidth?: "max-w-lg" | "max-w-2xl" | "max-w-3xl" | "max-w-4xl" | "max-w-6xl";
  leadingBack?: { href: string; label: string };
}) {
  const { brandName } = useSiteBrand();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useLayoutEffect(() => {
    const sync = () => setAuthed(Boolean(getStoredToken()));
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "neo-token" || e.key === "neo-user") sync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pathname]);

  return (
    <div className="relative z-[1] flex min-h-screen flex-col bg-[#f5f7fa] text-slate-900">
      <header className="neo-topbar sticky top-0 z-50 flex h-auto min-h-14 shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.35rem,env(safe-area-inset-top,0px))] pb-2 text-slate-900 sm:gap-3 sm:px-4 md:h-14 md:min-h-0 md:px-8 md:py-0 md:pt-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:gap-4">
          {leadingBack ? (
            <Link
              href={leadingBack.href}
              className="shrink-0 whitespace-nowrap rounded-lg px-1 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200/60 hover:text-slate-900 sm:text-sm"
            >
              ← {leadingBack.label}
            </Link>
          ) : null}
          <Link
            href="/"
            className={`flex min-w-0 items-center gap-2 sm:gap-2.5 ${
              leadingBack ? "max-w-[min(100%,14rem)] sm:max-w-[min(100%,18rem)]" : "max-w-[58%] sm:max-w-[65%] md:max-w-none"
            }`}
          >
            <NeoLogoMark className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            <span className="neo-gradient-text truncate text-base font-semibold tracking-tight sm:text-lg">
              {brandName}
            </span>
          </Link>
        </div>
        <nav className="flex shrink-0 items-center gap-2 text-xs text-slate-800 sm:gap-3 sm:text-sm">
          {authed ? (
            <Link
              href="/dashboard"
              className="whitespace-nowrap rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 font-medium shadow-[4px_4px_12px_rgba(15,23,42,0.06)] transition hover:bg-slate-50 sm:px-3.5"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="whitespace-nowrap font-medium text-slate-600 transition hover:text-slate-900"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="whitespace-nowrap rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 font-medium text-slate-900 shadow-[4px_4px_12px_rgba(15,23,42,0.06)] transition hover:bg-slate-50 sm:px-3.5"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>
      <div
        className={`relative z-[1] mx-auto flex w-full flex-1 flex-col px-4 py-8 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-10 md:px-8 md:pb-10 ${maxWidth}`}
      >
        {children}
      </div>
      <NeoBottomDock />
    </div>
  );
}
