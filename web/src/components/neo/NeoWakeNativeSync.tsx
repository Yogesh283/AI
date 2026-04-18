"use client";

import { useEffect } from "react";
import {
  subscribeNeoAlexaListen,
  subscribeNeoAssistantActive,
} from "@/lib/neoAssistantActive";
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
    void syncNativeWakeBridge();
    const u1 = subscribeNeoAssistantActive(() => void syncNativeWakeBridge());
    const u2 = subscribeNeoAlexaListen(() => void syncNativeWakeBridge());
    const u3 = subscribeNeoWakeScreenOffListen(() => void syncNativeWakeBridge());
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  return null;
}
