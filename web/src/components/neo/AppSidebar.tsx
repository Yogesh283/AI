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
    <aside className="neo-shell-surface relative z-[2] hidden w-[260px] shrink-0 flex-col rounded-[16px] md:ml-3 md:mt-3 md:flex md:h-[calc(100dvh-1.5rem)]">
      <div className="flex h-14 items-center border-b border-slate-200/80 px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <NeoLogoMark className="h-9 w-9 shrink-0" />
          <span className="neo-gradient-text truncate text-lg font-semibold tracking-tight">
            {brandName}
          </span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4 pt-1">
        {nav.map((item) => {
          if (item.kind === "simple") {
            const active = path === item.href || path?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium transition duration-300 ${
                  active
                    ? "bg-[#eff6ff] text-[#1e40af] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.25)]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
                className={`group flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium transition duration-300 ${
                  chatActive && !nestedOnly
                    ? "bg-[#eff6ff] text-[#1e40af] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.22)]"
                    : chatActive
                      ? "bg-slate-100 text-slate-800"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <IconChat active={chatActive} />
                {item.label}
              </Link>
              <Link
                href={item.nested.href}
                className={`ml-6 flex items-center gap-2 rounded-[12px] py-2 pl-3 pr-2 text-[12px] transition duration-300 ${
                  nestedOnly
                    ? "bg-[#eff6ff] font-medium text-[#1e40af] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.2)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
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
