import { registerPlugin } from "@capacitor/core";

export type NeoNativeRouterPlugin = {
  tryRouteCommand(options: { text: string }): Promise<{ handled: boolean }>;
};

/** Android: runs `NeoCommandRouter.execute` (real app intents, not WebView https). */
export const NeoNativeRouter = registerPlugin<NeoNativeRouterPlugin>("NeoNativeRouter", {
  web: {
    tryRouteCommand: async () => ({ handled: false }),
  },
});
