"use client";

import Image from "next/image";
import Link from "next/link";
import { NEO_ASSISTANT_NAME } from "@/lib/siteBranding";

function ChatBubbleIcon() {
  return (
    <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-[#00D4FF]/25 bg-[#0c121a]">
      <span
        className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
        aria-hidden
      />
      <svg
        viewBox="0 0 72 72"
        className="h-full w-full p-2.5 text-[#00D4FF]"
        aria-hidden
      >
        <path
          fill="currentColor"
          fillOpacity={0.15}
          stroke="currentColor"
          strokeWidth={1.25}
          d="M18 22c0-3.3 2.7-6 6-6h24c3.3 0 6 2.7 6 6v18c0 3.3-2.7 6-6 6H28l-8 8v-8h-2c-3.3 0-6-2.7-6-6V22z"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeOpacity={0.5}
          d="M28 28h16M28 34h10M28 40h14"
        />
      </svg>
    </div>
  );
}

export function DashboardModeCards() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-4 pb-8 pt-4 sm:px-6 md:px-10">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-8 text-center md:mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Home
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-white via-white to-white/75 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
            Welcome to {NEO_ASSISTANT_NAME}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-white/55 sm:text-[15px]">
            Talk live with voice or open smart chat — your assistant starts here.
          </p>
        </header>

        <div className="space-y-5">
        <Link
          href="/voice"
          className="group flex items-center gap-4 rounded-2xl border border-[#00D4FF]/35 bg-[#080c14]/90 p-4 shadow-[0_0_28px_rgba(0,212,255,0.12)] ring-1 ring-[#00D4FF]/20 transition hover:border-[#00D4FF]/55 hover:shadow-[0_0_36px_rgba(0,212,255,0.22)] md:gap-5 md:p-5"
        >
          <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
            <Image
              src="/avatars/voice-care-hero.png"
              alt=""
              fill
              className="object-cover object-center"
              sizes="72px"
            />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <h2 className="text-lg font-bold tracking-tight text-white md:text-xl">
              Neo Assistant
            </h2>
            <p className="mt-1 text-sm text-[#00D4FF]/85 md:text-[15px]">
              Your AI Personal Assistant
            </p>
          </div>
        </Link>

        <Link
          href="/chat"
          className="group flex items-center gap-4 rounded-2xl border border-[#00D4FF]/35 bg-[#080c14]/90 p-4 shadow-[0_0_28px_rgba(0,212,255,0.12)] ring-1 ring-[#00D4FF]/20 transition hover:border-[#00D4FF]/55 hover:shadow-[0_0_36px_rgba(0,212,255,0.22)] md:gap-5 md:p-5"
        >
          <ChatBubbleIcon />
          <div className="min-w-0 flex-1 text-left">
            <h2 className="text-lg font-bold tracking-tight text-white md:text-xl">
              Neo Chat
            </h2>
            <p className="mt-1 text-sm text-[#00D4FF]/85 md:text-[15px]">
              Smart AI Chat
            </p>
          </div>
        </Link>
        </div>
      </div>
    </div>
  );
}
