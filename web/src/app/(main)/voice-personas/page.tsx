"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { IconBack } from "@/components/neo/NeoIcons";
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
  readTtsSpeedPreset,
  writeTtsGender,
  writeTtsSpeedPreset,
  type TtsSpeedPreset,
} from "@/lib/voiceChat";

export default function VoicePersonasPage() {
  const [personaId, setPersonaId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStoredVoicePersonaId(),
  );
  const [ttsSpeed, setTtsSpeed] = useState<TtsSpeedPreset>(() =>
    typeof window === "undefined" ? "clear" : readTtsSpeedPreset(),
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

  const setSpeed = useCallback((p: TtsSpeedPreset) => {
    writeTtsSpeedPreset(p);
    setTtsSpeed(p);
  }, []);

  return (
    <div className="relative z-[1] mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-28 pt-4 md:min-h-0 md:flex-1 md:px-8 md:pb-12 md:pt-6">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/voice"
          className="neo-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] transition hover:border-[#00D4FF]/25"
          aria-label="Back to Voice"
        >
          <IconBack />
        </Link>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
            Voice
          </p>
          <h1 className="bg-gradient-to-r from-white to-white/75 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
            Choose your speaker
          </h1>
          <p className="mt-1 max-w-md text-[12px] leading-relaxed text-white/45">
            Logged-in users: your choice is saved in the account database. Everyone: also cached on
            this device. Speaking motion is animated (not real lip-sync from one still image).
          </p>
        </div>
      </header>

      <section className="mb-8">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
          Avatars
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4">
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
                    className="object-cover object-top"
                    sizes="(max-width:640px) 50vw, 280px"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="text-sm font-semibold text-white/90">{p.name}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
                    {p.ttsGender === "male" ? "Male voice" : "Female voice"}
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

      <section id="audio" className="mb-8 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-4 ring-1 ring-white/[0.04]">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
          Speech speed
        </p>
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-white/[0.1] bg-black/35 p-0.5"
          role="group"
          aria-label="Speech speed"
        >
          {(
            [
              ["slow", "Slow"],
              ["clear", "Clear"],
              ["fast", "Fast"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSpeed(id)}
              className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
                ttsSpeed === id
                  ? "bg-[#BD00FF]/25 text-[#e9c2ff]"
                  : "text-white/45 hover:text-white/75"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <p className="text-center text-[12px] text-white/40">
        <Link href="/voice" className="font-medium text-[#00D4FF]/85 hover:text-[#00D4FF] hover:underline">
          Back to Voice
        </Link>
      </p>
    </div>
  );
}
