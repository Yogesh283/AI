import { registerPlugin } from "@capacitor/core";

export type NeoNativeRouterPlugin = {
  tryRouteCommand(options: { text: string }): Promise<{ handled: boolean }>;
  startWakeListener(options?: { screenOffListen?: boolean }): Promise<void>;
  stopWakeListener(): Promise<void>;
  setWakeScreenOffListen(options: { enabled: boolean }): Promise<void>;
  getWakeScreenOffListen(): Promise<{ enabled: boolean }>;
  setWakePorcupineStream(options: { enabled: boolean }): Promise<void>;
  getWakePorcupineStream(): Promise<{ enabled: boolean }>;
};

/** Android: runs `NeoCommandRouter.execute` (real app intents, not WebView https). */
export const NeoNativeRouter = registerPlugin<NeoNativeRouterPlugin>("NeoNativeRouter", {
  web: {
    tryRouteCommand: async () => ({ handled: false }),
    startWakeListener: async () => {},
    stopWakeListener: async () => {},
    setWakeScreenOffListen: async () => {},
    getWakeScreenOffListen: async () => ({ enabled: false }),
    setWakePorcupineStream: async () => {},
    getWakePorcupineStream: async () => ({ enabled: false }),
  },
});
