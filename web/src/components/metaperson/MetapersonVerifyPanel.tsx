"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatDurationMs,
  getMetapersonVerifyState,
  msUntilRoutineVerifyAllowed,
  verifyMetapersonCredentials,
} from "@/lib/metapersonUtils";

/**
 * Lets you confirm server env works; reminds you to re-check after the 6-hour window.
 */
export function MetapersonVerifyPanel() {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(() => setNow(Date.now()), []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const state = getMetapersonVerifyState();
  const waitMs = useMemo(() => msUntilRoutineVerifyAllowed(), [now]);

  const onTest = async () => {
    setBusy(true);
    setToast(null);
    const r = await verifyMetapersonCredentials();
    setBusy(false);
    refresh();
    if (r.ok) setToast("Credentials OK — iframe can authenticate.");
    else setToast(r.error ?? "Check failed");
  };

  const lastOkLabel = state.lastOkAt
    ? new Date(state.lastOkAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : "—";

  return (
    <div className="mb-4 rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 text-[12px] text-white/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white/80">Integration check</p>
          <p className="mt-1 text-white/45">
            Last OK: <span className="text-white/65">{lastOkLabel}</span>
            {waitMs > 0 ? (
              <>
                {" "}
                · Next routine window in <span className="text-cyan-200/80">{formatDurationMs(waitMs)}</span>
              </>
            ) : (
              <span className="text-emerald-400/80"> · Routine re-check allowed</span>
            )}
          </p>
          {state.lastError ? (
            <p className="mt-1 text-amber-400/90" role="status">
              Last error: {state.lastError}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void onTest()}
          disabled={busy}
          className="shrink-0 rounded-xl border border-[#00D4FF]/40 bg-[#00D4FF]/15 px-4 py-2 text-xs font-semibold text-white transition hover:border-[#00D4FF]/65 disabled:opacity-45"
        >
          {busy ? "Testing…" : "Test credentials"}
        </button>
      </div>
      {toast ? (
        <p className="mt-2 text-[11px] text-cyan-200/85" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
