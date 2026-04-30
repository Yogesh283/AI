"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { NeoPageShell } from "@/components/neo/NeoPageShell";
import {
  fetchMe,
  getStoredToken,
  getStoredUser,
  patchVoicePersona,
  saveSession,
} from "@/lib/auth";
import {
  getVoicePersona,
  normalizeVoicePersonaId,
  readStoredVoicePersonaId,
  VOICE_PERSONAS,
  voicePersonaHasPortrait,
  writeStoredVoicePersonaId,
} from "@/lib/voicePersonas";
import {
  writeTtsGender,
} from "@/lib/voiceChat";

export default function VoicePersonasPage() {
  const [personaId, setPersonaId] = useState<string | null>(null);
  const active = getVoicePersona(personaId ?? undefined);

  useEffect(() => {
    setPersonaId(readStoredVoicePersonaId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = getStoredToken();
    if (!token) return;
    void (async () => {
      try {
        const u = await fetchMe();
        if (cancelled || !u.voice_persona_id) return;
        const remote = normalizeVoicePersonaId(u.voice_persona_id);
        const local = normalizeVoicePersonaId(readStoredVoicePersonaId());
        if (remote === local) return;
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
    <NeoPageShell
      navCenter={<span className="text-[13px] font-semibold tracking-tight text-slate-900">Voice avatar</span>}
      contentClassName="pt-0"
    >
      <p className="mb-6 mt-4 max-w-md text-[12px] leading-relaxed text-slate-600">
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
                    ? "border-[#2563eb]/45 bg-[#eff6ff] shadow-[0_0_24px_rgba(37,99,235,0.12)] ring-2 ring-[#2563eb]/30"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="relative aspect-[3/4] w-full bg-black/30">
                  {voicePersonaHasPortrait(p) ? (
                    <Image
                      src={p.imageSrc}
                      alt={p.name}
                      fill
                      className="object-cover object-center"
                      sizes="(max-width:640px) 50vw, 280px"
                      unoptimized={p.imageSrc.endsWith(".svg")}
                    />
                  ) : (
                    <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-slate-800/90 to-slate-950 px-4">
                      <span className="text-4xl font-bold text-white/90">{p.name.slice(0, 1)}</span>
                      <span className="text-center text-[11px] text-white/40">
                        {p.ttsGender === "female" ? "Woman" : "Man"} · No image
                      </span>
                    </div>
                  )}
                </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{p.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {p.ttsGender === "female" ? "Woman" : "Man"} · Human style
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Voice
                  </span>
                </div>
                {on ? (
                  <span className="absolute right-2 top-2 rounded-full bg-[#2563eb] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    Selected
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
    </NeoPageShell>
  );
}
