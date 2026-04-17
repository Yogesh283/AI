"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  recordMetapersonCredentialsError,
  recordMetapersonCredentialsOk,
} from "@/lib/metapersonUtils";

const IFRAME_SRC = "https://metaperson.avatarsdk.com/iframe.html";

type CredResponse = { clientId: string; clientSecret: string };

export function MetaPersonCreatorEmbed() {
  const [status, setStatus] = useState<"idle" | "ready" | "auth_error">("idle");
  const [hint, setHint] = useState<string | null>(null);
  const authSentRef = useRef(false);

  const authenticate = useCallback(async (source: MessageEventSource | null) => {
    if (!source || authSentRef.current) return;
    try {
      const r = await fetch("/api/metaperson-credentials");
      const data = (await r.json()) as CredResponse & { error?: string; hint?: string };
      if (!r.ok) {
        authSentRef.current = true;
        setStatus("auth_error");
        const msg = data.hint || data.error || `HTTP ${r.status}`;
        setHint(msg);
        recordMetapersonCredentialsError(msg);
        return;
      }
      (source as Window).postMessage(
        {
          eventName: "authenticate",
          clientId: data.clientId,
          clientSecret: data.clientSecret,
        },
        "*",
      );
      authSentRef.current = true;
      setStatus("ready");
      recordMetapersonCredentialsOk();
    } catch (e) {
      authSentRef.current = true;
      setStatus("auth_error");
      const msg = e instanceof Error ? e.message : String(e);
      setHint(msg);
      recordMetapersonCredentialsError(msg);
    }
  }, []);

  useEffect(() => {
    function onWindowMessage(ev: MessageEvent) {
      if (ev.data?.source !== "metaperson_creator") return;
      const evtName = ev.data?.eventName as string | undefined;
      if (evtName === "metaperson_creator_loaded") {
        void authenticate(ev.source);
      }
    }

    window.addEventListener("message", onWindowMessage);
    return () => window.removeEventListener("message", onWindowMessage);
  }, [authenticate]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {status === "auth_error" ? (
        <div
          className="mb-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100/95"
          role="alert"
        >
          <p className="font-semibold">MetaPerson auth not configured</p>
          <p className="mt-1 text-amber-100/80">{hint}</p>
        </div>
      ) : null}
      <div className="relative min-h-[min(72vh,640px)] flex-1 overflow-hidden rounded-xl border border-white/[0.08] bg-black/40 ring-1 ring-white/[0.04]">
        <iframe
          title="MetaPerson Creator"
          src={IFRAME_SRC}
          allow="microphone; fullscreen"
          className="h-full min-h-[min(72vh,640px)] w-full border-0"
        />
      </div>
      <p className="mt-2 text-[11px] text-white/40">
        Powered by Avatar SDK MetaPerson Creator. Export and advanced features require a valid developer account /
        plan per itSeez3D terms.
      </p>
    </div>
  );
}
