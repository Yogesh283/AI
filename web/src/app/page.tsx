"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { NeoPublicShell } from "@/components/neo/NeoPublicShell";
import { NeoLogoHead } from "@/components/neo/NeoLogoHead";
import { getStoredToken } from "@/lib/auth";

export default function LandingPage() {
  const router = useRouter();
  const { brandName } = useSiteBrand();

  useEffect(() => {
    if (getStoredToken()) router.replace("/dashboard");
  }, [router]);

  return (
    <NeoPublicShell maxWidth="max-w-6xl">
      <section className="neo-screen-card relative mx-auto mt-3 w-full overflow-hidden rounded-[26px] px-6 py-8 sm:px-8 md:px-10 md:py-10">
        <div className="pointer-events-none absolute -right-20 top-12 h-72 w-72 rounded-full bg-[#1f86ff]/25 blur-3xl" aria-hidden />
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#84d6ff]">
              {brandName}
            </p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Your Intelligent
              <br />
              AI Assistant
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/62 sm:text-base">
              Chat, search, write, analyze and automate tasks with one assistant for notes, meetings, reminders and daily workflows.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login" className="neo-blue-button rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110">
                Get Started
              </Link>
              <Link href="/register" className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10">
                Create Account
              </Link>
            </div>
          </div>
          <div className="relative flex items-center justify-center py-2">
            <div className="absolute h-56 w-56 rounded-full bg-[#2591ff]/30 blur-3xl" />
            <div className="relative flex h-52 w-52 items-center justify-center rounded-full border border-[#a8cbff]/40 bg-[radial-gradient(circle_at_30%_30%,rgba(182,229,255,0.45),rgba(34,120,255,0.58)_56%,rgba(10,29,76,0.95)_100%)] shadow-[0_0_70px_rgba(33,128,255,0.55)]">
              <NeoLogoHead className="h-20 w-20" priority />
            </div>
          </div>
        </div>
      </section>
    </NeoPublicShell>
  );
}
