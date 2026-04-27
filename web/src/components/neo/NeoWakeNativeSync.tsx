"use client";

import { useEffect } from "react";
import {
  NEO_ALEXA_LISTEN_KEY,
  NEO_ASSISTANT_ACTIVE_KEY,
  subscribeNeoAlexaListen,
  subscribeNeoAssistantActive,
  writeNeoAlexaListen,
  writeNeoAssistantActive,
} from "@/lib/neoAssistantActive";
import { isNativeCapacitor } from "@/lib/nativeAppLinks";
import {
  subscribeNeoWakeScreenOffListen,
  syncNativeWakeBridge,
} from "@/lib/neoWakeNative";

/**
 * Keeps Android `WakeWordForegroundService` aligned with Profile toggles while the user navigates inside the app
 * (not only while Profile / Hello Neo strip is mounted).
 */
export function NeoWakeNativeSync() {
  useEffect(() => {
    /* First APK launch: keys unset — turn Neo + wake listen on so voice commands work without hunting Profile. */
    if (isNativeCapacitor() && typeof window !== "undefined") {
      try {
        if (window.localStorage.getItem(NEO_ASSISTANT_ACTIVE_KEY) === null) {
          writeNeoAssistantActive(true);
        }
        if (window.localStorage.getItem(NEO_ALEXA_LISTEN_KEY) === null) {
          writeNeoAlexaListen(true);
        }
      } catch {
        /* ignore */
      }
    }
    void syncNativeWakeBridge();
    const u1 = subscribeNeoAssistantActive(() => void syncNativeWakeBridge());
    const u2 = subscribeNeoAlexaListen(() => void syncNativeWakeBridge());
    const u3 = subscribeNeoWakeScreenOffListen(() => void syncNativeWakeBridge());
    const onVis = () => void syncNativeWakeBridge();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      u1();
      u2();
      u3();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
