"use client";

import { GoogleLogin } from "@react-oauth/google";

type Intent = "signin" | "signup";

export function NeoGoogleSignIn({
  intent,
  onCredential,
  disabled,
}: {
  intent: Intent;
  onCredential: (idToken: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const cid = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!cid) return null;

  return (
    <div
      className={`w-full [&_iframe]:!w-full ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
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
        width="100%"
      />
    </div>
  );
}
