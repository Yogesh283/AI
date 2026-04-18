"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRef } from "react";

type Intent = "signin" | "signup";

/** GIS options forwarded to `google.accounts.id.initialize` (snake_case is required by Google). */
const GIS_WEBVIEW_OPTS = {
  use_fedcm_for_button: false,
  auto_select: false,
} as const;

/**
 * Google sign-in for web + Capacitor Android WebView.
 * Native Credential Manager was removed: it often surfaced "The user canceled the sign-in flow"
 * after account pick unless OAuth Android client + SHA-1 matched perfectly.
 * `MainActivity` enables third-party cookies and strips `; wv` from the UA for GIS.
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
  const onCredentialRef = useRef(onCredential);
  const onGoogleErrorRef = useRef(onGoogleError);
  onCredentialRef.current = onCredential;
  onGoogleErrorRef.current = onGoogleError;

  if (!cid) return null;

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
