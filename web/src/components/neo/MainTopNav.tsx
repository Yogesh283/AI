"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getStoredUser } from "@/lib/auth";

/** Single character for the profile chip — first character of display name. */
function firstCharFromProfileName(name: string) {
  const t = name.trim();
  if (!t) return "U";
  const first = [...t][0] ?? "U";
  return first.toLocaleUpperCase();
}

export const MAIN_NAV_MENU: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/chat?new=1", label: "New chat" },
  { href: "/memory", label: "Memory" },
  { href: "/voice", label: "Voice" },
  { href: "/profile", label: "Profile" },
  { href: "/avatars", label: "Avatars" },
  { href: "/customize", label: "Customize" },
];

type Props = {
  /** Shown centered (e.g. voice session status). */
  center?: ReactNode;
  /** Extra controls before the profile chip (e.g. language + Voice settings). */
  trailingBeforeProfile?: ReactNode;
};

export function MainTopNav({ center, trailingBeforeProfile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (u?.display_name?.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration read from localStorage
      setDisplayName(u.display_name.trim());
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close flyout on client navigation (incl. back/forward)
    setMenuOpen(false);
  }, [pathname]);

  const profileLetter = firstCharFromProfileName(displayName);

  return (
    <header className="sticky top-0 z-40 flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] bg-[#080a0f]/95 px-4 backdrop-blur-md sm:h-14 sm:gap-3 sm:px-5 md:px-6">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] text-white/90 shadow-[0_1px_8px_rgba(0,0,0,0.25)] transition hover:bg-white/[0.1]"
          aria-expanded={menuOpen}
          aria-controls="main-nav-menu"
          aria-label="Open menu"
        >
          <span className="flex h-[11px] w-[18px] flex-col justify-between" aria-hidden>
            <span className="h-0.5 w-[17px] rounded-sm bg-white/90" />
            <span className="h-0.5 w-[11px] rounded-sm bg-white/90" />
          </span>
        </button>
        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-black/50 md:bg-black/40"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <nav
              id="main-nav-menu"
              className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-[13.5rem] rounded-xl border border-white/[0.1] bg-[#121820] py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              role="navigation"
              aria-label="Main menu"
            >
              <p className="px-4 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                Menu
              </p>
              <ul className="space-y-0.5 px-1">
                {MAIN_NAV_MENU.map((item) => {
                  const isNewChat = item.href.includes("new=1");
                  const base = item.href.split("?")[0];
                  const active = isNewChat
                    ? false
                    : base === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                          active
                            ? "border-l-2 border-[#00D4FF] bg-[#00D4FF]/10 pl-[10px] text-white"
                            : "border-l-2 border-transparent pl-[10px] text-white/85 hover:bg-white/[0.06]"
                        }`}
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                <li className="mt-1 border-t border-white/[0.08] pt-1">
                  <button
                    type="button"
                    className="block w-full rounded-lg border-l-2 border-transparent px-3 py-2.5 pl-[10px] text-left text-sm font-medium text-rose-300/95 transition hover:bg-rose-500/10 hover:text-rose-200"
                    onClick={() => {
                      setMenuOpen(false);
                      clearSession();
                      router.replace("/login");
                    }}
                  >
                    Log out
                  </button>
                </li>
              </ul>
            </nav>
          </>
        ) : null}
      </div>

      {center ? (
        <div className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold tracking-tight text-white sm:text-[15px]">
          {center}
        </div>
      ) : (
        <div className="min-w-0 flex-1" aria-hidden />
      )}

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {trailingBeforeProfile}
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] py-1 pl-1 pr-2.5 transition hover:border-white/[0.12]"
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-[10px] font-bold text-white shadow-sm"
            aria-hidden
          >
            {profileLetter}
          </span>
          <span className="hidden max-w-[8rem] truncate text-xs font-medium text-white/80 sm:inline">
            {displayName || "Account"}
          </span>
        </Link>
      </div>
    </header>
  );
}
