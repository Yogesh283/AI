"use client";

import { GoogleLogin } from "@react-oauth/google";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";
import { useCallback, useEffect, useState } from "react";
import { isNativeCapacitor } from "@/lib/nativeAppLinks";

type Intent = "signin" | "signup";

/** GIS options forwarded to `google.accounts.id.initialize` (snake_case is required by Google). */
const GIS_WEBVIEW_OPTS = {
  use_fedcm_for_button: false,
  auto_select: false,
} as const;

/** Android APK: native Credential Manager flow — stays in Neo, no Chrome handoff. */
const useAndroidNativeGoogle =
  typeof window !== "undefined" && isNativeCapacitor() && Capacitor.getPlatform() === "android";

let nativeInitClientId: string | null = null;

async function ensureNativeGoogleInitialized(clientId: string): Promise<void> {
  const cid = clientId.trim();
  if (!cid) return;
  if (nativeInitClientId === cid) return;
  await GoogleSignIn.initialize({ clientId: cid });
  nativeInitClientId = cid;
}

export function NeoGoogleSignIn({
  clientId,
  intent,
  onCredential,
  onGoogleError,
  disabled,
}: {
  /** From build env or runtime `/api/public/google-client-id`. */
  clientId: string;
  intent: Intent;
  onCredential: (idToken: string) => void | Promise<void>;
  /** FedCM / blocked WebView / popup failures — show on login/register. */
  onGoogleError?: (message: string) => void;
  disabled?: boolean;
}) {
  const cid = clientId.trim();
  const [nativeBusy, setNativeBusy] = useState(false);

  useEffect(() => {
    if (!useAndroidNativeGoogle || !cid) return;
    void ensureNativeGoogleInitialized(cid).catch((e) => {
      onGoogleError?.(
        e instanceof Error
          ? e.message
          : "Could not start Google sign-in. Check Web client ID in Google Cloud and app signing SHA-1 for Android.",
      );
    });
  }, [cid, onGoogleError]);

  const runNativeSignIn = useCallback(async () => {
    if (!cid) return;
    setNativeBusy(true);
    try {
      await ensureNativeGoogleInitialized(cid);
      const result = await GoogleSignIn.signIn();
      if (result.idToken) {
        await onCredential(result.idToken);
      } else {
        onGoogleError?.("Google sign-in did not return a token. Try again or use email and password.");
      }
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Google sign-in failed. If this is the first Android build, add your debug SHA-1 in Google Cloud Console for this package.";
      onGoogleError?.(msg);
    } finally {
      setNativeBusy(false);
    }
  }, [cid, onCredential, onGoogleError]);

  if (!cid) return null;

  if (useAndroidNativeGoogle) {
    const busy = Boolean(disabled || nativeBusy);
    return (
      <div className="w-full">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runNativeSignIn()}
          className="neo-glass flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#4285F4]"
            aria-hidden
          >
            G
          </span>
          {nativeBusy ? "Signing in…" : "Continue with Google"}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className={disabled ? "pointer-events-none opacity-50" : ""}>
        <GoogleLogin
          onSuccess={(c) => {
            if (c.credential) void onCredential(c.credential);
          }}
          onError={() => {
            onGoogleError?.(
              "Google sign-in did not finish. On the app: try again, or use email and password. If it keeps failing, update WebView (Play Store) and check that this site’s URL is in Google Cloud “Authorized JavaScript origins”.",
            );
          }}
          context={intent === "signup" ? "signup" : "signin"}
          theme="filled_blue"
          text="continue_with"
          logo_alignment="left"
          shape="rectangular"
          size="large"
          {...(GIS_WEBVIEW_OPTS as unknown as Record<string, boolean>)}
        />
      </div>
    </div>
  );
}
