"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/neo/AppSidebar";
import { NeoBottomDock } from "@/components/neo/NeoBottomDock";
import { NeoWakeNativeSync } from "@/components/neo/NeoWakeNativeSync";
import { SessionExpiryBridge } from "@/components/neo/SessionExpiryBridge";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  const isChat = path === "/dashboard" || path === "/chat";
  const isVoice = path === "/voice";
  const isProfile = path === "/profile";
  const isPersonalAssistant = path === "/personal-assistant";
  /* Long scroll pages: pull-to-refresh fights vertical scroll on mobile WebViews */
  const pullToRefreshEnabled = !isChat && !isProfile && !isPersonalAssistant;
  const mainRef = useRef<HTMLElement | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const pullActiveRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const resetPull = useCallback(() => {
    pullActiveRef.current = false;
    pullStartYRef.current = null;
    setPullDistance(0);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!pullToRefreshEnabled || refreshing || e.touches.length !== 1) return;
      const el = mainRef.current;
      if (!el || el.scrollTop > 0) return;
      pullActiveRef.current = true;
      pullStartYRef.current = e.touches[0]?.clientY ?? null;
    },
    [pullToRefreshEnabled, refreshing]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!pullActiveRef.current || refreshing) return;
      const startY = pullStartYRef.current;
      if (startY == null) return;
      const currentY = e.touches[0]?.clientY ?? startY;
      const delta = currentY - startY;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      const el = mainRef.current;
      if (!el || el.scrollTop > 0) {
        resetPull();
        return;
      }
      e.preventDefault();
      setPullDistance(Math.min(130, delta * 0.65));
    },
    [refreshing, resetPull]
  );

  const onTouchEnd = useCallback(() => {
    if (!pullActiveRef.current || refreshing) {
      resetPull();
      return;
    }
    const trigger = pullDistance >= 84;
    resetPull();
    if (!trigger) return;
    setRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 140);
  }, [pullDistance, refreshing, resetPull]);

  return (
    <div className="relative min-h-[100dvh] pb-[env(safe-area-inset-bottom,0px)]">
      <SessionExpiryBridge />
      <NeoWakeNativeSync />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,#fafbfd_0%,#f5f7fa_45%,#edeff3_100%)]"
        aria-hidden
      />
      <div
        className={`relative z-[1] flex min-h-0 ${
          isChat || isVoice
            ? "h-[100dvh] max-h-[100dvh] overflow-hidden"
            : "min-h-[100dvh] md:h-[100dvh] md:max-h-[100dvh] md:overflow-hidden"
        }`}
      >
        <AppSidebar />
        <main
          ref={mainRef}
          onTouchStart={pullToRefreshEnabled ? onTouchStart : undefined}
          onTouchMove={pullToRefreshEnabled ? onTouchMove : undefined}
          onTouchEnd={pullToRefreshEnabled ? onTouchEnd : undefined}
          className={`relative flex min-h-0 min-w-0 flex-1 flex-col bg-transparent pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] pt-[env(safe-area-inset-top,0px)] md:pb-0 md:pt-0 ${
            isChat || isVoice
              ? "h-full max-h-full overflow-hidden overscroll-none"
              : isProfile
                ? "overflow-hidden overscroll-none [touch-action:pan-y]"
                : "overflow-y-auto overscroll-y-contain [touch-action:pan-y]"
          }`}
        >
          {pullToRefreshEnabled ? (
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2"
            >
              <div
                className={`rounded-full border border-[#6A5CFF]/30 bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#6A5CFF] shadow transition-opacity duration-200 ${
                  pullDistance > 3 || refreshing ? "opacity-100" : "opacity-0"
                }`}
                style={{ transform: `translateY(${Math.max(0, pullDistance - 18)}px)` }}
              >
                {refreshing
                  ? "Refreshing..."
                  : pullDistance >= 84
                  ? "Release to refresh"
                  : "Pull to refresh"}
              </div>
            </div>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {children}
          </div>
        </main>
      </div>
      <NeoBottomDock />
    </div>
  );
}
