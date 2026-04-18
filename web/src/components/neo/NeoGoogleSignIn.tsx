"use client";

import { GoogleLogin } from "@react-oauth/google";

type Intent = "signin" | "signup";

/** GIS options forwarded to `google.accounts.id.initialize` (snake_case is required by Google). */
const GIS_WEBVIEW_OPTS = {
  use_fedcm_for_button: false,
  auto_select: false,
} as const;

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
  if (!cid) return null;

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
