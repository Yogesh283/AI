"use client";

import { useEffect, useRef } from "react";

/** Keeps screen on during voice session (supported browsers only). */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    let cancelled = false;
    nav.wakeLock
      ?.request("screen")
      .then((sentinel) => {
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        lockRef.current = sentinel;
      })
      .catch(() => {
        /* user may need gesture; policy may deny */
      });

    return () => {
      cancelled = true;
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
