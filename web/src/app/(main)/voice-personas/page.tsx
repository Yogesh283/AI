"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { MainTopNav } from "@/components/neo/MainTopNav";
import {
  fetchMe,
  getStoredToken,
  getStoredUser,
  patchVoicePersona,
  saveSession,
} from "@/lib/auth";
import {
  getVoicePersona,
  readStoredVoicePersonaId,
  VOICE_PERSONAS,
  writeStoredVoicePersonaId,
} from "@/lib/voicePersonas";
import {
  writeTtsGender,
} from "@/lib/voiceChat";

export default function VoicePersonasPage() {
  const [personaId, setPersonaId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStoredVoicePersonaId(),
  );
  const active = getVoicePersona(personaId ?? undefined);

  useEffect(() => {
    let cancelled = false;
    const token = getStoredToken();
    if (!token) return;
    void (async () => {
      try {
        const u = await fetchMe();
        if (cancelled || !u.voice_persona_id) return;
        const prev = getStoredUser();
        if (prev) saveSession(token, { ...prev, voice_persona_id: u.voice_persona_id });
        writeStoredVoicePersonaId(u.voice_persona_id);
        writeTtsGender(getVoicePersona(u.voice_persona_id).ttsGender);
        setPersonaId(u.voice_persona_id);
      } catch {
        /* offline or stale token */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const select = useCallback((id: string) => {
    const p = getVoicePersona(id);
    writeStoredVoicePersonaId(id);
    writeTtsGender(p.ttsGender);
    setPersonaId(id);
    const token = getStoredToken();
    if (!token) return;
    void (async () => {
      try {
        const u = await patchVoicePersona(id);
        saveSession(token, u);
      } catch {
        /* MySQL off or network — local choice still applies */
      }
    })();
  }, []);

  return (
    <div className="relative z-[1] mx-auto flex min-h-screen max-w-3xl flex-col bg-[#080a0f] px-4 pb-28 pt-0 md:min-h-0 md:flex-1 md:px-8 md:pb-12 md:pt-0">
      <MainTopNav center={<span className="text-white">Voice avatar</span>} />

      <p className="mb-6 mt-4 max-w-md text-[12px] leading-relaxed text-white/45">
        Select how your assistant appears in voice mode.
      </p>

      <section className="mb-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {VOICE_PERSONAS.map((p) => {
            const on = active.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p.id)}
                className={`group relative overflow-hidden rounded-2xl border text-left transition ${
                  on
                    ? "border-[#00D4FF]/55 bg-[#00D4FF]/10 shadow-[0_0_28px_rgba(0,212,255,0.2)] ring-2 ring-[#00D4FF]/35"
                    : "border-white/[0.1] bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
                }`}
              >
                <div className="relative aspect-[3/4] w-full bg-black/30">
                  <Image
                    src={p.imageSrc}
                    alt={p.name}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width:640px) 50vw, 280px"
                    unoptimized={p.imageSrc.endsWith(".svg")}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <span className="block text-sm font-semibold text-white/90">{p.name}</span>
                    <span className="text-[11px] text-white/45">
                      {p.ttsGender === "female" ? "Woman" : "Man"} · Human style
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-white/50">
                    Voice
                  </span>
                </div>
                {on ? (
                  <span className="absolute right-2 top-2 rounded-full bg-[#00D4FF]/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0a0d12]">
                    Selected
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
