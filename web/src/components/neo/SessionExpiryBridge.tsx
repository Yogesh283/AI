"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getStoredToken } from "@/lib/auth";

const PUBLIC_PATH_PREFIXES = ["/login", "/register", "/onboarding"];

/**
 * When the tab/app comes back to the foreground, re-check the 24h session.
 * If expired, `getStoredToken()` clears storage — send user to login instead of a half-broken UI.
 */
export function SessionExpiryBridge() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const check = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (pathname === "/" || PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return;
      }
      if (!getStoredToken()) {
        router.replace("/login?expired=1");
      }
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [pathname, router]);

  return null;
}
