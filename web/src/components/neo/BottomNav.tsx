"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconMemory,
  IconMicCenter,
  IconTools,
  IconUser,
} from "@/components/neo/NeoIcons";

const items = [
  { href: "/memory", label: "Memory", Icon: IconMemory },
  { href: "/voice", label: "Voice", center: true },
  { href: "/tools", label: "Tools", Icon: IconTools },
  { href: "/profile", label: "Profile", Icon: IconUser },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="neo-safe-pb fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#060910]/92 backdrop-blur-2xl md:hidden">
      <div className="mx-auto flex max-w-lg items-end justify-between px-3 pb-3 pt-1">
        {items.map((it) => {
          const active =
            path === it.href || path?.startsWith(`${it.href}/`);
          if (it.center) {
            return (
              <Link
                key={it.href}
                href={it.href}
                className="relative -mt-7 flex flex-col items-center"
              >
                <span
                  className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-gradient-to-br from-[#00D4FF] via-[#00a8e6] to-[#BD00FF] shadow-[0_0_48px_rgba(0,212,255,0.5),0_0_80px_rgba(189,0,255,0.25)] ring-4 ring-[#0b0e14]/80"
                  aria-label={it.label}
                >
                  <IconMicCenter />
                </span>
                <span className="mt-1 text-[10px] font-medium tracking-wide text-white/55">
                  {it.label}
                </span>
              </Link>
            );
          }
          const Icon = it.Icon!;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex min-w-[56px] flex-col items-center gap-0.5 py-1 text-[10px] font-medium tracking-wide ${
                active ? "text-[#00D4FF]" : "text-white/40"
              }`}
            >
              <span className={active ? "drop-shadow-[0_0_8px_rgba(0,212,255,0.6)]" : ""}>
                <Icon active={active} />
              </span>
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
