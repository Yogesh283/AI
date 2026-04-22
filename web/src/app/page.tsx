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
      <section className="neo-screen-card relative mx-auto mt-3 w-full overflow-hidden rounded-[20px] px-6 py-8 sm:px-8 md:px-10 md:py-10">
        <div className="pointer-events-none absolute -right-20 top-12 h-72 w-72 rounded-full bg-[#2563eb]/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute left-[12%] top-[18%] h-1.5 w-1.5 rounded-full bg-[#2563eb]/70 shadow-[0_0_12px_rgba(37,99,235,0.45)]" aria-hidden />
        <div className="pointer-events-none absolute left-[28%] top-[12%] h-1 w-1 rounded-full bg-[#6366f1]/70 shadow-[0_0_10px_rgba(99,102,241,0.5)]" aria-hidden />
        <div className="pointer-events-none absolute right-[24%] top-[28%] h-1.5 w-1.5 rounded-full bg-[#3b82f6]/65 shadow-[0_0_10px_rgba(59,130,246,0.45)]" aria-hidden />
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2563EB]">{brandName}</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              Your Intelligent
              <br />
              AI Assistant
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
              Chat, search, write, analyze and automate tasks with one assistant for notes, meetings, reminders and daily workflows.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="neo-blue-button rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Get Started
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-[4px_4px_14px_rgba(15,23,42,0.06)] transition hover:bg-slate-50"
              >
                Create Account
              </Link>
            </div>
          </div>
          <div className="relative flex items-center justify-center py-2">
            <div className="absolute h-56 w-56 rounded-full bg-[#2563eb]/12 blur-3xl" />
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-slate-200/90 bg-[radial-gradient(circle_at_30%_30%,rgba(239,246,255,0.98),rgba(219,234,254,0.92)_56%,rgba(191,219,254,0.88)_100%)] shadow-[0_16px_48px_rgba(37,99,235,0.18)]">
              <span className="absolute inset-[10px] rounded-full border border-[#2563eb]/25" aria-hidden />
              <NeoLogoHead className="h-20 w-20 drop-shadow-[0_4px_16px_rgba(37,99,235,0.25)]" priority />
            </div>
          </div>
        </div>
      </section>
    </NeoPublicShell>
  );
}
