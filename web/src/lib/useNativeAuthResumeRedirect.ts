"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken } from "@/lib/auth";
import { isNativeCapacitor } from "@/lib/nativeAppLinks";

/**
 * APK WebView: after Google account picker / system sheet, the JWT callback sometimes
 * runs late or the view resumes without React noticing. If a token was saved, leave auth pages.
 */
export function useNativeAuthResumeRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeCapacitor()) return;

    const tryLeaveAuthScreen = () => {
      if (!getStoredToken()) return;
      try {
        const path = window.location.pathname.replace(/\/$/, "") || "/";
        if (path.endsWith("/login") || path.endsWith("/register")) {
          router.replace("/dashboard");
        }
      } catch {
        /* ignore */
      }
    };

    const onVis = () => {
      if (document.visibilityState === "visible") tryLeaveAuthScreen();
    };

    window.addEventListener("pageshow", tryLeaveAuthScreen);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pageshow", tryLeaveAuthScreen);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);
}
