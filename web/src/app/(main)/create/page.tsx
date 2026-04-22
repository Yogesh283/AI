"use client";

import Link from "next/link";
import { Mic, MessageSquarePlus, Sparkles } from "lucide-react";
import { MainTopNav } from "@/components/neo/MainTopNav";

export default function CreatePage() {
  const navCenter = (
    <span className="text-[13px] font-semibold tracking-tight text-slate-900">Create</span>
  );

  const cards = [
    {
      href: "/chat?new=1",
      title: "New conversation",
      desc: "Start a fresh chat thread with your assistant.",
      Icon: MessageSquarePlus,
    },
    {
      href: "/voice",
      title: "Voice session",
      desc: "Speak naturally and hear AI replies in real time.",
      Icon: Mic,
    },
    {
      href: "/dashboard",
      title: "Explore tools",
      desc: "Browse modes, memory, and personalization.",
      Icon: Sparkles,
    },
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F5F7FA] md:min-h-0">
      <MainTopNav center={navCenter} />
      <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 md:px-8 md:pb-16">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
          <section className="neo-screen-card rounded-[26px] px-6 py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563EB]/90">
              Quick create
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              What would you like to start?
            </h1>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-slate-600">
              Pick an action below — everything stays in sync with your account and memory.
            </p>
          </section>

          <div className="flex flex-col gap-4">
            {cards.map(({ href, title, desc, Icon }) => (
              <Link
                key={href}
                href={href}
                className="neo-list-row group flex gap-4 rounded-[24px] p-5 transition duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#eff6ff] text-[#2563EB] shadow-[inset_2px_2px_6px_rgba(255,255,255,0.85)] transition duration-300 group-hover:shadow-[0_0_22px_rgba(37,99,235,0.15)]">
                  <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-slate-900">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-600">{desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
