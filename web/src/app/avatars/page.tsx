"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GradientButton } from "@/components/neo/GradientButton";
import { NeoPublicShell } from "@/components/neo/NeoPublicShell";
import { getNeoAvatar, readStoredAvatarId, writeStoredAvatarId } from "@/lib/avatars";

const avatars = [
  { id: "neo-core", name: "NeoXAI Core", tag: "Smart & Balanced", premium: false },
  {
    id: "arc-hud",
    name: "Arc HUD",
    tag: "Sci-fi HUD · arc reactor glow",
    premium: false,
  },
  { id: "nova", name: "Nova", tag: "Friendly & Warm", premium: false },
  { id: "atlas", name: "Atlas", tag: "Professional", premium: true },
  { id: "spark", name: "Spark", tag: "Energetic", premium: false },
  { id: "luna", name: "Luna", tag: "Calm & Creative", premium: true },
  { id: "astra", name: "Astra", tag: "Strategic", premium: false },
  { id: "yuna", name: "Yuna", tag: "Korean woman", premium: false },
];

export default function AvatarsPage() {
  const [tab, setTab] = useState<"all" | "free" | "premium">("all");
  const [sel, setSel] = useState("neo-core");

  useEffect(() => {
    const saved = readStoredAvatarId();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-hydration read
      setSel(saved);
    }
  }, []);

  useEffect(() => {
    writeStoredAvatarId(sel);
  }, [sel]);

  const list = avatars.filter((a) => {
    if (tab === "free") return !a.premium;
    if (tab === "premium") return a.premium;
    return true;
  });

  return (
    <NeoPublicShell maxWidth="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Choose Your NeoXAI</h1>
        <p className="mt-1 text-sm text-white/45">
          Select your personal AI assistant style.
        </p>
        <div className="mt-4 rounded-2xl border border-[#00D4FF]/25 bg-[#00D4FF]/[0.07] p-4 ring-1 ring-[#00D4FF]/15">
          <p className="text-sm font-semibold text-white/90">3D avatar (Avatar SDK)</p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            Open MetaPerson Creator in the browser — needs{" "}
            <code className="text-cyan-300/85">METAPERSON_CLIENT_ID</code> /{" "}
            <code className="text-cyan-300/85">SECRET</code> in server env.
          </p>
          <Link
            href="/avatars/metaperson"
            className="mt-3 inline-flex text-sm font-semibold text-[#00D4FF] transition hover:text-[#7eeafc]"
          >
            MetaPerson Creator →
          </Link>
        </div>

        <details className="mt-4 rounded-2xl border border-white/[0.08] bg-black/25 p-4 text-left ring-1 ring-white/[0.04]">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white/85 [&::-webkit-details-marker]:hidden">
            अन्य 3D विकल्प (Unity के अलावा) ▾
          </summary>
          <ul className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-white/50">
            <li>
              <span className="font-semibold text-white/70">Unreal Engine</span> — शक्तिशाली 3D / एनीमेशन; डेस्कटॉप या बिल्ड टारगेट।{" "}
              <a
                href="https://www.unrealengine.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00D4FF]/90 underline-offset-2 hover:underline"
              >
                unrealengine.com
              </a>
            </li>
            <li>
              <span className="font-semibold text-white/70">Three.js / Babylon.js</span> — ब्राउज़र में WebGL रियल-टाइम 3D (आमतौर पर glTF/GLB)।{" "}
              <a href="https://threejs.org/" target="_blank" rel="noopener noreferrer" className="text-[#00D4FF]/90 underline-offset-2 hover:underline">
                threejs.org
              </a>
              {" · "}
              <a
                href="https://www.babylonjs.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00D4FF]/90 underline-offset-2 hover:underline"
              >
                babylonjs.com
              </a>
            </li>
            <li>
              <span className="font-semibold text-white/70">Ready Player Me</span> — कम-कोड 3D अवतार + API इंटीग्रेशन।{" "}
              <a
                href="https://readyplayer.me/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00D4FF]/90 underline-offset-2 hover:underline"
              >
                readyplayer.me
              </a>
            </li>
          </ul>
          <p className="mt-3 text-[11px] text-white/35">
            पूरी तुलना और <code className="text-white/45">model.fbx</code> नोट्स रिपो में{" "}
            <code className="text-cyan-300/80">avatar/README.md</code> में हैं।
          </p>
        </details>
      </header>
      <div className="mb-6 flex gap-2 rounded-2xl bg-black/30 p-1 ring-1 ring-white/10">
        {(["all", "free", "premium"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-semibold capitalize transition ${
              tab === t
                ? "bg-gradient-to-r from-[#00D4FF]/35 to-[#BD00FF]/25 text-white shadow-[0_0_20px_rgba(0,212,255,0.2)]"
                : "text-white/40"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {list.map((a) => {
          const on = sel === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSel(a.id)}
              className={`neo-glass relative rounded-[24px] p-4 text-left transition ${
                on
                  ? "ring-2 ring-[#00D4FF] shadow-[0_0_28px_rgba(0,212,255,0.25)]"
                  : "ring-1 ring-white/[0.06]"
              }`}
            >
              {on && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#00D4FF] to-[#BD00FF] text-xs font-bold text-[#050912] shadow-lg">
                  ✓
                </span>
              )}
              <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-2xl bg-[#0a0f1c] ring-1 ring-white/10">
                <Image
                  src={getNeoAvatar(a.id).imageSrc}
                  alt=""
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 45vw, 220px"
                />
              </div>
              <div className="flex items-start justify-between gap-1 pr-2">
                <span className="font-semibold">{a.name}</span>
                {a.premium && <span title="Premium">👑</span>}
              </div>
              <p className="mt-1 text-xs text-white/40">{a.tag}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-10 border-t border-white/[0.08] pt-8">
        <GradientButton href="/customize" className="w-full !py-4 text-base">
          Continue with NeoXAI
        </GradientButton>
      </div>
    </NeoPublicShell>
  );
}
