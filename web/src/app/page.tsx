"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SPLASH } from "@/shared/neoContent";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { NeoPublicShell } from "@/components/neo/NeoPublicShell";
import { NeoLogoHead } from "@/components/neo/NeoLogoHead";
import { getStoredToken } from "@/lib/auth";

function SplashRingGradients({ uid }: { uid: string }) {
  return (
    <defs>
      <linearGradient id={`splashRing-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00f2ff" />
        <stop offset="50%" stopColor="#9d50bb" />
        <stop offset="100%" stopColor="#bc00ff" />
      </linearGradient>
    </defs>
  );
}

export default function SplashPage() {
  const router = useRouter();
  const { brandName } = useSiteBrand();
  const [p, setP] = useState(0);
  /** `checking`: token probe; `guest`: show splash; `redirect` — logged-in, avoid animating splash repeatedly */
  const [gate, setGate] = useState<"checking" | "guest" | "redirect">("checking");

  useEffect(() => {
    if (getStoredToken()) {
      setGate("redirect");
      router.replace("/dashboard");
      return;
    }
    setGate("guest");
    const splashMs = 2000;
    const tickMs = 50;
    const steps = Math.ceil(splashMs / tickMs);
    const inc = 100 / steps;
    const t = setInterval(() => {
      setP((x) => (x >= 100 ? 100 : Math.min(100, x + inc)));
    }, tickMs);
    const goLogin = setTimeout(() => {
      router.replace("/login");
    }, splashMs);
    return () => {
      clearInterval(t);
      clearTimeout(goLogin);
    };
  }, [router]);

  if (gate === "checking" || gate === "redirect") {
    return (
      <NeoPublicShell maxWidth="max-w-lg">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 py-16">
          <NeoLogoHead className="h-16 w-16 opacity-90" priority />
          <p className="text-center text-sm text-white/50">{gate === "redirect" ? "Opening app…" : "Loading…"}</p>
        </div>
      </NeoPublicShell>
    );
  }

  return (
    <NeoPublicShell maxWidth="max-w-lg">
      <div className="relative flex flex-1 flex-col gap-8 pb-12 pt-2 md:gap-10 md:pb-16">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="neo-splash-hero relative border border-white/[0.07]"
        >
          <div
            className="neo-splash-star-cluster left-[10%] top-[14%] opacity-80"
            aria-hidden
          />
          <div
            className="neo-splash-star-cluster right-[12%] top-[22%] opacity-60"
            style={{ animationDelay: "1.2s" }}
            aria-hidden
          />

          <div className="relative mx-auto flex min-h-[min(68vh,420px)] flex-col items-center justify-center px-4 pb-28 pt-16 md:min-h-[440px] md:pb-32 md:pt-20">
            <div className="relative flex h-[min(72vw,280px)] w-[min(72vw,280px)] items-center justify-center md:h-[280px] md:w-[280px]">
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
              >
                <svg
                  viewBox="0 0 200 200"
                  className="h-full w-full"
                  aria-hidden
                >
                  <SplashRingGradients uid="a" />
                  <circle
                    cx="100"
                    cy="100"
                    r="92"
                    fill="none"
                    stroke={`url(#splashRing-a)`}
                    strokeWidth="2.5"
                    strokeDasharray="120 460"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="82"
                    fill="none"
                    stroke={`url(#splashRing-a)`}
                    strokeWidth="1.5"
                    strokeOpacity={0.4}
                    strokeDasharray="95 420"
                    strokeLinecap="round"
                  />
                </svg>
              </motion.div>
              <motion.div
                className="absolute inset-2 flex items-center justify-center opacity-80"
                animate={{ rotate: -360 }}
                transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
              >
                <svg
                  viewBox="0 0 200 200"
                  className="h-full w-full"
                  aria-hidden
                >
                  <SplashRingGradients uid="b" />
                  <circle
                    cx="100"
                    cy="100"
                    r="72"
                    fill="none"
                    stroke={`url(#splashRing-b)`}
                    strokeWidth="2"
                    strokeDasharray="70 450"
                    strokeLinecap="round"
                  />
                </svg>
              </motion.div>

              <motion.div
                className="relative z-[2] flex flex-col items-center justify-center"
                animate={{
                  filter: [
                    "drop-shadow(0 0 20px rgba(0,242,255,0.35))",
                    "drop-shadow(0 0 32px rgba(188,0,255,0.45))",
                    "drop-shadow(0 0 20px rgba(0,242,255,0.35))",
                  ],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <NeoLogoHead
                  priority
                  className="h-[min(28vw,7.5rem)] w-[min(28vw,7.5rem)] shrink-0 sm:h-32 sm:w-32"
                />
                <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-white/40">
                  {brandName}
                </p>
              </motion.div>
            </div>

            <p className="relative z-[2] mt-2 max-w-xs text-center text-sm font-medium text-white/50">
              {SPLASH.tagline}
            </p>
          </div>

          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 text-[#bc00ff]/25"
            aria-hidden
          >
            <svg
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <path
                fill="currentColor"
                d="M0,96 C240,32 480,112 720,72 C960,32 1200,96 1440,56 L1440,120 L0,120 Z"
                opacity={0.45}
              />
              <path
                fill="url(#splashWaveGrad)"
                d="M0,108 C320,48 560,100 720,84 C960,64 1180,108 1440,72 L1440,120 L0,120 Z"
                opacity={0.35}
              />
              <defs>
                <linearGradient id="splashWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00f2ff" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#bc00ff" stopOpacity={0.35} />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
          className="space-y-3 px-1"
        >
          <p className="text-center text-[11px] font-medium tracking-[0.2em] text-white/55">
            {SPLASH.loadingLabel}
          </p>
          <div className="neo-splash-progress-track">
            <motion.div
              className="neo-splash-progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${p}%` }}
              transition={{ type: "spring", stiffness: 38, damping: 18 }}
            />
          </div>
        </motion.div>
      </div>
    </NeoPublicShell>
  );
}
