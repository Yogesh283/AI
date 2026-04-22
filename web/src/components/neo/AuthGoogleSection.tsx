"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchGoogleWebClientId } from "@/lib/googleClientId";

/** Client-only: avoids SSR/hydration serving `GoogleLogin` (GIS) in the APK — GIS opens Chrome on `accounts.google.com/gsi/tr` and never returns. */
const NeoGoogleSignIn = dynamic(
  () => import("@/components/neo/NeoGoogleSignIn").then((m) => m.NeoGoogleSignIn),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-12 w-full animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
        aria-hidden
      />
    ),
  },
);

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
      <div className="h-px flex-1 bg-slate-200" />
      <span className="shrink-0 text-xs uppercase tracking-wider text-slate-500">
        Or use email and password
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );

  const dividerBeforeGoogle = (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="shrink-0 text-xs uppercase tracking-wider text-slate-500">
        Or continue with Google
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );

  const googleBlock =
    !ready && !buildId ? (
      <p className="text-center text-[11px] text-slate-500">Loading sign-in options…</p>
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
          className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400"
          aria-label="Continue with Google"
          title="Google sign-in is not configured yet"
        >
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#4285F4] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
            aria-hidden
          >
            G
          </span>
          Continue with Google
        </button>
        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          Set{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-800">
            NEXT_PUBLIC_GOOGLE_CLIENT_ID
          </code>{" "}
          or server-only{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[10px] text-slate-800">GOOGLE_OAUTH_WEB_CLIENT_ID</code>{" "}
          in <code className="rounded bg-slate-100 px-1 font-mono text-[10px] text-slate-800">web/.env.production</code>,
          plus <code className="rounded bg-slate-100 px-1 font-mono text-[10px] text-slate-800">GOOGLE_CLIENT_IDS</code> in
          backend, then restart{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[10px] text-slate-800">neo-web</code>.
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
