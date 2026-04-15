"use client";

import { NeoGoogleSignIn } from "@/components/neo/NeoGoogleSignIn";

type Intent = "signin" | "signup";

/**
 * Shown after email/password form: divider + Google button, or a short dev hint.
 */
export function AuthGoogleSection({
  intent,
  onCredential,
  disabled,
}: {
  intent: Intent;
  onCredential: (idToken: string) => void | Promise<void>;
  disabled: boolean;
}) {
  const hasGoogle = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  return (
    <div className="mt-8 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="shrink-0 text-xs uppercase tracking-wider text-white/35">
          Or continue with Google
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {hasGoogle ? (
        <NeoGoogleSignIn intent={intent} disabled={disabled} onCredential={onCredential} />
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
            Add{" "}
            <code className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[10px] text-[#00D4FF]/85">
              NEXT_PUBLIC_GOOGLE_CLIENT_ID
            </code>{" "}
            in <code className="rounded bg-white/[0.08] px-1 font-mono text-[10px]">web/.env.local</code> and{" "}
            <code className="rounded bg-white/[0.08] px-1 font-mono text-[10px]">GOOGLE_CLIENT_IDS</code> in backend{" "}
            <code className="rounded bg-white/[0.08] px-1 font-mono text-[10px]">.env</code> to enable this button.
          </p>
        </>
      )}
    </div>
  );
}
