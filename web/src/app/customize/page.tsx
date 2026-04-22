"use client";

import { useState } from "react";
import Link from "next/link";
import { GradientButton } from "@/components/neo/GradientButton";
import { NeoPublicShell } from "@/components/neo/NeoPublicShell";

const voices = [
  { id: "male", label: "Male", sub: "Deep" },
  { id: "female", label: "Female", sub: "Soft" },
  { id: "ai", label: "AI", sub: "Robotic" },
];

const chips = ["Friendly", "Professional", "Motivational", "Funny"];

export default function CustomizePage() {
  const [voice, setVoice] = useState("male");
  const [picked, setPicked] = useState<string[]>(["Friendly"]);
  const [speed, setSpeed] = useState(55);
  const [detail, setDetail] = useState(40);

  function toggle(c: string) {
    setPicked((p) =>
      p.includes(c) ? p.filter((x) => x !== c) : [...p, c].slice(-3)
    );
  }

  return (
    <NeoPublicShell maxWidth="max-w-3xl">
      <header className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-block text-sm text-[#00D4FF]/90"
        >
          ← Back
        </Link>
        <h1 className="neo-gradient-text text-2xl font-semibold tracking-tight">
          Voice &amp; Personality
        </h1>
        <p className="mt-1 text-sm text-white/45">
          Tune how NeoXAI sounds and responds.
        </p>
      </header>

      <section className="neo-screen-card mb-8 p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Select Voice
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {voices.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVoice(v.id)}
              className={`neo-card-soft rounded-[12px] px-2 py-4 text-center transition ${
                voice === v.id
                  ? "ring-2 ring-[#22D3EE] shadow-[0_0_18px_rgba(34,211,238,0.22)]"
                  : ""
              }`}
            >
              <p className="text-sm font-semibold">{v.label}</p>
              <p className="mt-1 text-[11px] text-white/40">{v.sub}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="neo-screen-card mb-8 p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Personality
        </h2>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const on = picked.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                className={`neo-pill px-4 py-2 text-sm font-medium transition ${
                  on
                    ? "border-[#22D3EE]/50 bg-[#22D3EE]/15 text-[#E2E8F0]"
                    : "text-white/55"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </section>

      <section className="neo-screen-card mb-10 space-y-6 rounded-[12px] p-6">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-white/70">Speaking Speed</span>
            <span className="text-[#22D3EE]">{speed}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={speed}
            onChange={(e) => setSpeed(+e.target.value)}
            className="h-2 w-full accent-[#22D3EE]"
          />
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-white/70">Response Detail</span>
            <span className="text-[#7C3AED]">{detail}%</span>
          </div>
          <div className="mb-1 flex justify-between text-[10px] uppercase text-white/35">
            <span>Concise</span>
            <span>Detailed</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={detail}
            onChange={(e) => setDetail(+e.target.value)}
            className="h-2 w-full accent-[#7C3AED]"
          />
        </div>
      </section>

      <div className="mt-10 border-t border-white/[0.08] pt-8">
        <GradientButton href="/dashboard" className="w-full !py-4 text-base">
          Save &amp; Continue
        </GradientButton>
      </div>
    </NeoPublicShell>
  );
}
