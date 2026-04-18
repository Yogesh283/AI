"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getStoredToken, patchVoicePersona, saveSession, type AuthUser } from "@/lib/auth";
import {
  readHelloNeoTtsGender,
  readHelloNeoTtsSpeedPreset,
  readHelloNeoTtsTonePreset,
  readTtsSpeedPreset,
  readTtsTonePreset,
  writeHelloNeoTtsGender,
  writeHelloNeoTtsSpeedPreset,
  writeHelloNeoTtsTonePreset,
  writeTtsGender,
  writeTtsSpeedPreset,
  writeTtsTonePreset,
  type TtsSpeedPreset,
  type TtsTonePreset,
  type TtsVoiceGender,
} from "@/lib/voiceChat";
import {
  getVoicePersona,
  normalizeVoicePersonaId,
  writeStoredVoicePersonaId,
} from "@/lib/voicePersonas";

type Props = {
  user: AuthUser;
  onUserUpdated: (u: AuthUser) => void;
  onMessage: (msg: string | null, err: string | null) => void;
};

const SPEED_OPTIONS: { id: TtsSpeedPreset; label: string }[] = [
  { id: "slow", label: "Slow" },
  { id: "natural", label: "Normal" },
  { id: "clear", label: "Crisp" },
  { id: "fast", label: "Fast" },
];

const TONE_OPTIONS: { id: TtsTonePreset; label: string; hint: string }[] = [
  { id: "warm", label: "Warm", hint: "Heavier / deeper" },
  { id: "bright", label: "Bright", hint: "Lighter / thinner" },
];

export function ProfileVoiceSettings({ user, onUserUpdated, onMessage }: Props) {
  const [persona, setPersona] = useState<"arjun" | "sara">(() =>
    normalizeVoicePersonaId(user.voice_persona_id),
  );
  const [speed, setSpeed] = useState<TtsSpeedPreset>(() => readTtsSpeedPreset());
  const [tone, setTone] = useState<TtsTonePreset>(() => readTtsTonePreset());
  const [helloNeoGender, setHelloNeoGender] = useState<TtsVoiceGender>("female");
  const [helloNeoSpeed, setHelloNeoSpeed] = useState<TtsSpeedPreset>("natural");
  const [helloNeoTone, setHelloNeoTone] = useState<TtsTonePreset>("warm");
  const [savingPersona, setSavingPersona] = useState(false);

  useEffect(() => {
    setHelloNeoGender(readHelloNeoTtsGender());
    setHelloNeoSpeed(readHelloNeoTtsSpeedPreset());
    setHelloNeoTone(readHelloNeoTtsTonePreset());
  }, []);

  const applyPersona = useCallback(
    async (id: "arjun" | "sara") => {
      const pid = normalizeVoicePersonaId(id);
      setSavingPersona(true);
      onMessage(null, null);
      const p = getVoicePersona(pid);
      writeStoredVoicePersonaId(pid);
      writeTtsGender(p.ttsGender);
      setPersona(pid);
      const token = getStoredToken();
      if (token) {
        try {
          const u = await patchVoicePersona(pid);
          saveSession(token, u);
          onUserUpdated(u);
          onMessage("Voice assistant updated. It will use this persona next time you talk.", null);
        } catch (e) {
          onMessage(
            null,
            e instanceof Error ? e.message : "Could not sync voice to your account (saved on this device).",
          );
        }
      } else {
        onMessage("Saved on this device. Sign in to sync across devices.", null);
      }
      setSavingPersona(false);
    },
    [onMessage, onUserUpdated],
  );

  const applySpeed = useCallback(
    (p: TtsSpeedPreset) => {
      writeTtsSpeedPreset(p);
      setSpeed(p);
      onMessage("Voice chat speed saved (Hello Neo has its own below).", null);
    },
    [onMessage],
  );

  const applyTone = useCallback(
    (t: TtsTonePreset) => {
      writeTtsTonePreset(t);
      setTone(t);
      onMessage("Voice chat tone saved (Hello Neo has its own below).", null);
    },
    [onMessage],
  );

  const applyHelloNeoGender = useCallback(
    (g: TtsVoiceGender) => {
      writeHelloNeoTtsGender(g);
      setHelloNeoGender(g);
      onMessage("Hello Neo voice saved (separate from voice chat).", null);
    },
    [onMessage],
  );

  const applyHelloNeoSpeed = useCallback(
    (p: TtsSpeedPreset) => {
      writeHelloNeoTtsSpeedPreset(p);
      setHelloNeoSpeed(p);
      onMessage("Hello Neo command speed saved.", null);
    },
    [onMessage],
  );

  const applyHelloNeoTone = useCallback(
    (t: TtsTonePreset) => {
      writeHelloNeoTtsTonePreset(t);
      setHelloNeoTone(t);
      onMessage("Hello Neo command tone saved.", null);
    },
    [onMessage],
  );

  return (
    <section className="neo-glass overflow-hidden rounded-[22px] ring-1 ring-white/[0.06]">
      <div className="border-b border-white/[0.07] px-5 py-3.5">
        <h2 className="text-sm font-semibold text-white/90">Voice settings</h2>
        <p className="mt-0.5 text-xs text-white/40">
          Voice chat page and Hello Neo commands use <span className="text-white/55">separate</span> speed and tone —
          set both. Changes apply on the next spoken reply.
        </p>
      </div>
      <div className="space-y-6 px-5 py-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Assistant voice (woman / man)
          </p>
          <div className="flex max-w-md rounded-xl border border-white/[0.1] bg-black/30 p-0.5">
            <button
              type="button"
              disabled={savingPersona}
              onClick={() => void applyPersona("sara")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                persona === "sara"
                  ? "bg-[#00D4FF]/20 text-white shadow-[inset_0_0_0_1px_rgba(0,212,255,0.35)]"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/85"
              }`}
            >
              Woman (Sara)
            </button>
            <button
              type="button"
              disabled={savingPersona}
              onClick={() => void applyPersona("arjun")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                persona === "arjun"
                  ? "bg-[#00D4FF]/20 text-white shadow-[inset_0_0_0_1px_rgba(0,212,255,0.35)]"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/85"
              }`}
            >
              Man (Arjun)
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/35">
            When you pick Woman, the assistant keeps using a woman voice until you change it.
          </p>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Voice chat — speaking speed
          </p>
          <div className="flex max-w-md flex-wrap gap-1 rounded-xl border border-white/[0.1] bg-black/30 p-0.5">
            {SPEED_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => applySpeed(o.id)}
                className={`min-w-[5.5rem] flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide sm:text-[13px] ${
                  speed === o.id
                    ? "bg-[#00D4FF]/20 text-white shadow-[inset_0_0_0_1px_rgba(0,212,255,0.35)]"
                    : "text-white/45 hover:bg-white/[0.06] hover:text-white/85"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Voice chat — voice weight
          </p>
          <div className="flex max-w-md gap-1 rounded-xl border border-white/[0.1] bg-black/30 p-0.5">
            {TONE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => applyTone(o.id)}
                className={`flex-1 rounded-lg py-2.5 text-left px-3 transition sm:px-4 ${
                  tone === o.id
                    ? "bg-[#00D4FF]/20 shadow-[inset_0_0_0_1px_rgba(0,212,255,0.35)]"
                    : "hover:bg-white/[0.06]"
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${tone === o.id ? "text-white" : "text-white/55"}`}
                >
                  {o.label}
                </span>
                <span className="mt-0.5 block text-[10px] text-white/35">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#00D4FF]/15 bg-[#00D4FF]/[0.04] p-4 space-y-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#00D4FF]/90">
              Hello Neo commands (top bar)
            </p>
            <p className="text-[11px] text-white/38">
              Wake replies, time, open apps — <span className="text-white/55">alag</span> voice system from voice chat.
              Default gender is the other one; default tone is opposite to voice chat until you set it here.
            </p>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Voice (man / woman)</p>
            <div className="flex max-w-md rounded-xl border border-white/[0.1] bg-black/30 p-0.5">
              <button
                type="button"
                onClick={() => applyHelloNeoGender("female")}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  helloNeoGender === "female"
                    ? "bg-[#00D4FF]/20 text-white shadow-[inset_0_0_0_1px_rgba(0,212,255,0.35)]"
                    : "text-white/50 hover:bg-white/[0.06] hover:text-white/85"
                }`}
              >
                Woman
              </button>
              <button
                type="button"
                onClick={() => applyHelloNeoGender("male")}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  helloNeoGender === "male"
                    ? "bg-[#00D4FF]/20 text-white shadow-[inset_0_0_0_1px_rgba(0,212,255,0.35)]"
                    : "text-white/50 hover:bg-white/[0.06] hover:text-white/85"
                }`}
              >
                Man
              </button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Speaking speed</p>
            <div className="flex max-w-md flex-wrap gap-1 rounded-xl border border-white/[0.1] bg-black/30 p-0.5">
              {SPEED_OPTIONS.map((o) => (
                <button
                  key={`neo-${o.id}`}
                  type="button"
                  onClick={() => applyHelloNeoSpeed(o.id)}
                  className={`min-w-[5.5rem] flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide sm:text-[13px] ${
                    helloNeoSpeed === o.id
                      ? "bg-[#00D4FF]/20 text-white shadow-[inset_0_0_0_1px_rgba(0,212,255,0.35)]"
                      : "text-white/45 hover:bg-white/[0.06] hover:text-white/85"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Voice weight</p>
            <div className="flex max-w-md gap-1 rounded-xl border border-white/[0.1] bg-black/30 p-0.5">
              {TONE_OPTIONS.map((o) => (
                <button
                  key={`neo-tone-${o.id}`}
                  type="button"
                  onClick={() => applyHelloNeoTone(o.id)}
                  className={`flex-1 rounded-lg py-2.5 text-left px-3 transition sm:px-4 ${
                    helloNeoTone === o.id
                      ? "bg-[#00D4FF]/20 shadow-[inset_0_0_0_1px_rgba(0,212,255,0.35)]"
                      : "hover:bg-white/[0.06]"
                  }`}
                >
                  <span
                    className={`block text-sm font-semibold ${helloNeoTone === o.id ? "text-white" : "text-white/55"}`}
                  >
                    {o.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-white/35">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4 sm:flex-row">
          <Link
            href="/avatars"
            className="flex flex-1 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] py-3 text-sm font-medium text-white/90 transition hover:bg-white/[0.09]"
          >
            Change avatar
          </Link>
          <Link
            href="/voice-personas"
            className="flex flex-1 items-center justify-center rounded-xl border border-[#00D4FF]/25 bg-[#00D4FF]/10 py-3 text-sm font-medium text-[#00D4FF] transition hover:bg-[#00D4FF]/15"
          >
            Voice appearance
          </Link>
        </div>
      </div>
    </section>
  );
}
