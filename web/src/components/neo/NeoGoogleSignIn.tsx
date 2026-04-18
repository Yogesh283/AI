"use client";

import { GoogleLogin } from "@react-oauth/google";

type Intent = "signin" | "signup";

export function NeoGoogleSignIn({
  clientId,
  intent,
  onCredential,
  disabled,
}: {
  /** From build env or runtime `/api/public/google-client-id`. */
  clientId: string;
  intent: Intent;
  onCredential: (idToken: string) => void | Promise<void>;
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
          onError={() => {}}
          context={intent === "signup" ? "signup" : "signin"}
          theme="filled_blue"
          text="continue_with"
          logo_alignment="left"
          shape="rectangular"
          size="large"
        />
      </div>
    </div>
  );
}
