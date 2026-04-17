"use client";

import { useEffect, useRef, useState } from "react";
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [fallback, setFallback] = useState(false);
  if (!cid) return null;

  useEffect(() => {
    setFallback(false);
    const t = window.setTimeout(() => {
      const hasIframe = Boolean(rootRef.current?.querySelector("iframe"));
      if (!hasIframe) setFallback(true);
    }, 2200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div ref={rootRef} className="w-full">
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
      {fallback ? (
        <p className="mt-2 text-center text-[11px] text-white/45">
          Google button is unavailable on this device/WebView. Please use Email login or open this page in Chrome.
        </p>
      ) : null}
    </div>
  );
}
