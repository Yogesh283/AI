"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChat,
  IconMemory,
  IconMicCenter,
  IconTools,
  IconUser,
} from "@/components/neo/NeoIcons";

const items = [
  { href: "/memory", label: "Memory", Icon: IconMemory },
  { href: "/chat", label: "Chat", Icon: IconChat },
  { href: "/voice", label: "Voice", center: true },
  { href: "/tools", label: "Tools", Icon: IconTools },
  { href: "/profile", label: "Profile", Icon: IconUser },
];

function isRouteActive(
  path: string | null,
  href: string,
  center?: boolean
): boolean {
  if (!path) return false;
  if (center) {
    return (
      path === "/voice" ||
      path.startsWith("/voice/") ||
      path.startsWith("/voice-personas")
    );
  }
  return path === href || path.startsWith(`${href}/`);
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.1] bg-[#0a0c10]/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-2xl md:hidden">
      <div className="mx-auto flex max-w-lg items-end justify-between gap-0.5 px-1 pt-1 sm:px-2">
        {items.map((it) => {
          const active = isRouteActive(path, it.href, it.center);
          if (it.center) {
            return (
              <Link
                key={it.href}
                href={it.href}
                className="relative -mt-[1.2rem] flex min-w-[3.5rem] flex-col items-center"
              >
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2ec4ff] via-[#00a8e6] to-[#a855f7] shadow-[0_6px_20px_rgba(0,180,255,0.3),0_3px_12px_rgba(120,60,200,0.2)] ring-[3px] ring-[#07090e] ${
                    active ? "ring-[#0a0c10]" : ""
                  }`}
                  aria-label={it.label}
                >
                  <IconMicCenter />
                </span>
                <span className="mt-1 text-[10px] font-semibold tracking-wide text-white">
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
              className={`flex min-w-[2.85rem] flex-col items-center gap-0.5 py-0.5 text-[10px] font-medium tracking-wide sm:min-w-[3.25rem] ${
                active ? "text-[#00D4FF]" : "text-white/45"
              }`}
            >
              <span className={active ? "drop-shadow-[0_0_10px_rgba(0,212,255,0.45)]" : ""}>
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
