"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SPLASH } from "@/shared/neoContent";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { NeoPublicShell } from "@/components/neo/NeoPublicShell";
import { NeoLogoHead } from "@/components/neo/NeoLogoHead";
import { GradientButton } from "@/components/neo/GradientButton";

const featureCards = [
  {
    label: "Chat",
    sub: "Your assistant",
    icon: "💬",
    href: "/chat",
    ring: "hover:border-[#00D4FF]/35 hover:shadow-[0_0_28px_rgba(0,212,255,0.12)]",
  },
  {
    label: "Voice",
    sub: "Speak naturally",
    icon: "🎙",
    href: "/voice",
    ring: "hover:border-[#BD00FF]/30 hover:shadow-[0_0_28px_rgba(189,0,255,0.12)]",
  },
  {
    label: "Memory",
    sub: "Context that sticks",
    icon: "🧠",
    href: "/memory",
    ring: "hover:border-cyan-400/25 hover:shadow-[0_0_24px_rgba(34,211,238,0.1)]",
  },
  {
    label: "Tools",
    sub: "Writer & more",
    icon: "✨",
    href: "/tools",
    ring: "hover:border-violet-400/35 hover:shadow-[0_0_24px_rgba(167,139,250,0.12)]",
  },
] as const;

export default function SplashPage() {
  const { brandName } = useSiteBrand();
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setP((x) => (x >= 100 ? 100 : x + 2.5));
    }, 60);
    return () => clearInterval(t);
  }, []);

  return (
    <NeoPublicShell maxWidth="max-w-4xl">
      <div className="relative flex flex-1 flex-col px-1 pb-8 pt-2 md:pb-12">
        {/* soft hero glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-[8%] h-[min(52vw,22rem)] w-[min(92vw,28rem)] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#00D4FF]/18 via-[#9D50BB]/10 to-transparent blur-3xl"
          aria-hidden
        />

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-1 flex-col items-center justify-center gap-10 pb-8 pt-4 md:gap-12 md:pb-12"
        >
          <motion.div
            className="relative"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div
              className="pointer-events-none absolute inset-[-18%] rounded-full border border-white/[0.06] opacity-70"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-[-28%] rounded-full border border-[#00D4FF]/10 opacity-40"
              aria-hidden
            />
            <NeoLogoHead
              priority
              className="relative z-[1] h-32 w-28 shrink-0 drop-shadow-[0_0_40px_rgba(0,212,255,0.35)] sm:h-40 sm:w-36"
            />
          </motion.div>

          <div className="relative max-w-lg text-center">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.5 }}
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00D4FF]/75"
            >
              Welcome
            </motion.p>
            <h1 className="neo-gradient-text mx-auto max-w-[min(92vw,18rem)] text-[clamp(2.5rem,9vw,3.75rem)] font-extrabold leading-[0.95] tracking-tight sm:max-w-none">
              {brandName}
            </h1>
            <div className="mx-auto mt-5 h-px w-16 bg-gradient-to-r from-transparent via-[#00D4FF]/60 to-transparent" />
            <p className="mt-5 text-base font-medium tracking-wide text-white/55 sm:text-lg">
              {SPLASH.tagline}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-white/38">
              Aapka assistant — Hindi & English, voice, memory, tools — sab ek jagah.
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:max-w-xl sm:grid-cols-4 sm:gap-3.5">
            {featureCards.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href={f.href}
                  className={`neo-glass group flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.08] px-3 py-4 text-center ring-1 ring-white/[0.04] transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06] ${f.ring}`}
                >
                  <span className="text-2xl drop-shadow-[0_0_14px_rgba(0,212,255,0.2)] transition group-hover:scale-110">
                    {f.icon}
                  </span>
                  <span className="text-sm font-semibold text-white/90">{f.label}</span>
                  <span className="text-[10px] font-medium leading-tight text-white/38">
                    {f.sub}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="neo-glass relative mx-auto mt-2 w-full max-w-md space-y-6 rounded-[28px] border border-white/[0.1] p-6 ring-1 ring-[#00D4FF]/10 sm:max-w-lg"
        >
          <div>
            <p className="mb-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.32em] text-white/40">
              {SPLASH.loadingLabel}
            </p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#00D4FF] via-[#9D50BB] to-[#BD00FF]"
                style={{ boxShadow: "0 0 16px rgba(0,212,255,0.4)" }}
                initial={{ width: 0 }}
                animate={{ width: `${p}%` }}
                transition={{ type: "spring", stiffness: 38, damping: 18 }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <GradientButton href="/onboarding" className="w-full !py-4 text-[15px] shadow-[0_8px_32px_rgba(0,212,255,0.2)]">
              Get started
            </GradientButton>
            <div className="grid grid-cols-2 gap-3">
              <GradientButton href="/login" variant="outline" className="!py-3.5">
                Sign in
              </GradientButton>
              <GradientButton href="/register" variant="outline" className="!py-3.5">
                Register
              </GradientButton>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl py-2.5 text-center text-sm text-white/40 transition hover:bg-white/[0.04] hover:text-white/75"
            >
              Skip to app →
            </Link>
          </div>
        </motion.div>
      </div>
    </NeoPublicShell>
  );
}
