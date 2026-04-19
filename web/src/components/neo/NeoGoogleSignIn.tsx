"use client";

import { GoogleLogin } from "@react-oauth/google";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";
import { useCallback, useEffect, useRef, useState } from "react";
import { isCapacitorAndroidShell, isNativeCapacitor } from "@/lib/nativeAppLinks";

type Intent = "signin" | "signup";

/** GIS options forwarded to `google.accounts.id.initialize` (snake_case is required by Google). */
const GIS_WEBVIEW_OPTS = {
  use_fedcm_for_button: false,
  auto_select: false,
} as const;

let nativeInitClientId: string | null = null;
let nativeInitInflight: Promise<void> | null = null;

async function ensureNativeGoogleInitialized(clientId: string): Promise<void> {
  const id = clientId.trim();
  if (!id) return;
  if (nativeInitClientId === id) return;
  if (nativeInitInflight) {
    await nativeInitInflight;
    if (nativeInitClientId === id) return;
  }
  nativeInitInflight = GoogleSignIn.initialize({ clientId: id })
    .then(() => {
      nativeInitClientId = id;
    })
    .finally(() => {
      nativeInitInflight = null;
    });
  await nativeInitInflight;
}

/**
 * Web: `GoogleLogin` (GIS). **Android APK:** native Credential Manager so Google account
 * flow stays **inside the app** (no jumping out to Chrome).
 */
export function NeoGoogleSignIn({
  clientId,
  intent,
  onCredential,
  onGoogleError,
  disabled,
}: {
  clientId: string;
  intent: Intent;
  onCredential: (idToken: string) => void | Promise<void>;
  onGoogleError?: (message: string) => void;
  disabled?: boolean;
}) {
  const cid = clientId.trim();
  const [nativeBusy, setNativeBusy] = useState(false);
  const onCredentialRef = useRef(onCredential);
  const onGoogleErrorRef = useRef(onGoogleError);
  onCredentialRef.current = onCredential;
  onGoogleErrorRef.current = onGoogleError;

  /*
   * Never use GIS (`GoogleLogin`) inside the Android shell: it opens accounts.google.com in Chrome and never returns.
   * `androidBridge` is present immediately on Capacitor Android; `getPlatform()` can still say `"web"` on the first
   * paint, which would lock the broken GIS branch until a full remount — so prefer the bridge check.
   */
  const inAppAndroidGoogle =
    isCapacitorAndroidShell() ||
    (Capacitor.getPlatform() === "android" &&
      (Capacitor.isNativePlatform() || isNativeCapacitor()));

  useEffect(() => {
    if (!inAppAndroidGoogle || !cid) return;
    void ensureNativeGoogleInitialized(cid).catch((e) => {
      onGoogleErrorRef.current?.(
        e instanceof Error
          ? e.message
          : "Could not start Google sign-in. Check Web client ID in Google Cloud and app signing SHA-1 for Android.",
      );
    });
  }, [cid, inAppAndroidGoogle]);

  const runNativeSignIn = useCallback(async () => {
    if (!cid) return;
    setNativeBusy(true);
    try {
      await ensureNativeGoogleInitialized(cid);
      const result = await GoogleSignIn.signIn();
      if (result.idToken) {
        await onCredentialRef.current(result.idToken);
      } else {
        onGoogleErrorRef.current?.(
          "Google sign-in did not return a token. Try again or use email and password.",
        );
      }
    } catch (e) {
      const code =
        typeof e === "object" && e !== null && "code" in e
          ? String((e as { code?: string }).code ?? "")
          : "";
      const raw =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      /* Native plugin maps GetCredentialCancellationException → SIGN_IN_CANCELED (often overlay / back, not only "user cancel"). */
      if (code === "SIGN_IN_CANCELED" || /canceled|cancelled/i.test(raw)) {
        onGoogleErrorRef.current?.(
          "Google sign-in was interrupted (another dialog on screen, back button, or missing Android setup). " +
            "Try again with no mic/notification popups. In Google Cloud, add this debug APK SHA-1 for package com.neo.assistant (Android OAuth client) and use the same Web client ID as the server.",
        );
        return;
      }
      const msg =
        e instanceof Error
          ? e.message
          : "Google sign-in failed. If this is the first Android build, add your debug SHA-1 in Google Cloud Console for this package.";
      onGoogleErrorRef.current?.(msg);
    } finally {
      setNativeBusy(false);
    }
  }, [cid]);

  if (!cid) return null;

  if (inAppAndroidGoogle) {
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
            if (c.credential) void onCredentialRef.current(c.credential);
          }}
          onError={() => {
            onGoogleErrorRef.current?.(
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
