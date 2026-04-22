"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChat,
  IconMemory,
  IconMicCenter,
  IconHome,
  IconUser,
} from "@/components/neo/NeoIcons";
import { NeoLogoMark } from "@/components/neo/NeoLogoHead";
import { useSiteBrand } from "@/components/SiteBrandProvider";

type SimpleNav = {
  kind: "simple";
  href: string;
  label: string;
  Icon: typeof IconHome;
};

type ChatNav = {
  kind: "chat";
  href: string;
  label: string;
  nested: { href: string; label: string };
};

const nav: (SimpleNav | ChatNav)[] = [
  { kind: "simple", href: "/dashboard", label: "Home", Icon: IconHome },
  {
    kind: "chat",
    href: "/chat",
    label: "Chat",
    nested: { href: "/voice", label: "Personal Assistant" },
  },
  { kind: "simple", href: "/profile", label: "Profile", Icon: IconUser },
  { kind: "simple", href: "/memory", label: "Memory", Icon: IconMemory },
];

export function AppSidebar() {
  const path = usePathname();
  const { brandName } = useSiteBrand();

  return (
    <aside className="relative z-[2] hidden w-[260px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0c0f14]/98 backdrop-blur-xl md:flex">
      <div className="flex h-14 items-center border-b border-white/[0.06] px-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5"
        >
          <NeoLogoMark className="h-9 w-9 shrink-0 drop-shadow-[0_0_14px_rgba(0,206,209,0.35)]" />
          <span className="neo-gradient-text truncate text-lg font-semibold tracking-tight">
            {brandName}
          </span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4 pt-1">
        {nav.map((item) => {
          if (item.kind === "simple") {
            const active =
              path === item.href || path?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-[#0d1a28] text-[#00D4FF] shadow-[inset_0_0_0_1px_rgba(0,212,255,0.22)]"
                    : "text-white/55 hover:bg-white/[0.06] hover:text-white/90"
                }`}
              >
                <item.Icon active={active} />
                {item.label}
              </Link>
            );
          }

          const chatActive =
            path === item.href ||
            path?.startsWith(`${item.href}/`) ||
            path === item.nested.href ||
            path?.startsWith(`${item.nested.href}/`);
          const nestedOnly =
            path === item.nested.href || path?.startsWith(`${item.nested.href}/`);

          return (
            <div key={item.href} className="flex flex-col gap-0.5">
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  chatActive && !nestedOnly
                    ? "bg-[#0d1a28] text-[#00D4FF] shadow-[inset_0_0_0_1px_rgba(0,212,255,0.18)]"
                    : chatActive
                      ? "bg-white/[0.04] text-white/80"
                      : "text-white/55 hover:bg-white/[0.06] hover:text-white/90"
                }`}
              >
                <IconChat active={chatActive} />
                {item.label}
              </Link>
              <Link
                href={item.nested.href}
                className={`ml-6 flex items-center gap-2 rounded-lg py-2 pl-3 pr-2 text-[12px] transition ${
                  nestedOnly
                    ? "bg-[#0d1a28] font-medium text-[#00D4FF] shadow-[inset_0_0_0_1px_rgba(0,212,255,0.18)]"
                    : "text-white/45 hover:bg-white/[0.05] hover:text-white/75"
                }`}
              >
                <span className="opacity-50" aria-hidden>
                  └
                </span>
                <span className="opacity-90">
                  <IconMicCenter />
                </span>
                {item.nested.label}
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
