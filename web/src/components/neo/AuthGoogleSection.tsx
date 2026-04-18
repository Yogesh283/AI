"use client";

import { useEffect, useState } from "react";
import { NeoGoogleSignIn } from "@/components/neo/NeoGoogleSignIn";
import { fetchGoogleWebClientId } from "@/lib/googleClientId";

type Intent = "signin" | "signup";

/**
 * Google sign-in + optional divider. `beforeForm`: primary CTA above email/password (APK / splash → login flow).
 */
export function AuthGoogleSection({
  intent,
  onCredential,
  onGoogleError,
  disabled,
  layout = "afterForm",
}: {
  intent: Intent;
  onCredential: (idToken: string) => void | Promise<void>;
  onGoogleError?: (message: string) => void;
  disabled: boolean;
  /** `beforeForm` — Continue with Google first; `afterForm` — below the password form. */
  layout?: "beforeForm" | "afterForm";
}) {
  const buildId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  const [clientId, setClientId] = useState(buildId);
  const [ready, setReady] = useState(Boolean(buildId));

  useEffect(() => {
    if (buildId) return;
    let cancelled = false;
    void fetchGoogleWebClientId().then((id) => {
      if (!cancelled) {
        setClientId(id);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [buildId]);

  const hasGoogle = Boolean(clientId);

  const dividerAfterGoogle = (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-white/10" />
      <span className="shrink-0 text-xs uppercase tracking-wider text-white/35">
        Or use email and password
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );

  const dividerBeforeGoogle = (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-white/10" />
      <span className="shrink-0 text-xs uppercase tracking-wider text-white/35">
        Or continue with Google
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );

  const googleBlock =
    !ready && !buildId ? (
      <p className="text-center text-[11px] text-white/40">Loading sign-in options…</p>
    ) : hasGoogle ? (
      <NeoGoogleSignIn
        clientId={clientId}
        intent={intent}
        disabled={disabled}
        onCredential={onCredential}
        onGoogleError={onGoogleError}
      />
    ) : (
      <>
        <button
          type="button"
          disabled
          className="neo-glass flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.03] px-4 text-sm font-semibold text-white/55"
          aria-label="Continue with Google"
          title="Google sign-in is not configured yet"
        >
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#4285F4]"
            aria-hidden
          >
            G
          </span>
          Continue with Google
        </button>
        <p className="text-center text-[11px] leading-relaxed text-white/38">
          Set{" "}
          <code className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[10px] text-[#00D4FF]/85">
            NEXT_PUBLIC_GOOGLE_CLIENT_ID
          </code>{" "}
          or server-only{" "}
          <code className="rounded bg-white/[0.08] px-1 font-mono text-[10px]">GOOGLE_OAUTH_WEB_CLIENT_ID</code> in{" "}
          <code className="rounded bg-white/[0.08] px-1 font-mono text-[10px]">web/.env.production</code>, plus{" "}
          <code className="rounded bg-white/[0.08] px-1 font-mono text-[10px]">GOOGLE_CLIENT_IDS</code> in backend, then
          restart <code className="rounded bg-white/[0.08] px-1 font-mono text-[10px]">neo-web</code>.
        </p>
      </>
    );

  if (layout === "beforeForm") {
    return (
      <div className="mt-2 flex flex-col gap-4">
        {googleBlock}
        {dividerAfterGoogle}
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-4">
      {dividerBeforeGoogle}
      {googleBlock}
    </div>
  );
}
