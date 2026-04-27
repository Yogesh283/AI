"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getStoredUser } from "@/lib/auth";
import { useSiteBrand } from "@/components/SiteBrandProvider";

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
  { href: "/create", label: "Create" },
  { href: "/memory", label: "Memory" },
  { href: "/voice", label: "Voice" },
  { href: "/profile", label: "Profile" },
  { href: "/customize", label: "Customize" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms", label: "Terms & Conditions" },
];

type Props = {
  center?: ReactNode;
  trailingBeforeProfile?: ReactNode;
};

export function MainTopNav({ center, trailingBeforeProfile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { brandName } = useSiteBrand();
  const [displayName, setDisplayName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (u?.display_name?.trim()) {
      setDisplayName(u.display_name.trim());
    }
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const profileLetter = firstCharFromProfileName(displayName);

  return (
    <header className="neo-topbar sticky top-0 z-40 flex h-[52px] shrink-0 items-center justify-between gap-2 px-4 text-slate-900 sm:h-14 sm:gap-3 sm:px-5 md:px-6">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-700 shadow-[3px_3px_10px_rgba(15,23,42,0.06)] transition hover:bg-slate-50"
          aria-expanded={menuOpen}
          aria-controls="main-nav-menu"
          aria-label="Open menu"
        >
          <span className="flex h-[11px] w-[18px] flex-col justify-between" aria-hidden>
            <span className="h-0.5 w-[17px] rounded-sm bg-slate-700" />
            <span className="h-0.5 w-[11px] rounded-sm bg-slate-700" />
          </span>
        </button>
        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-slate-900/25"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <nav
              id="main-nav-menu"
              className="neo-shell-surface absolute left-0 top-[calc(100%+8px)] z-50 min-w-[13.5rem] rounded-[12px] py-2"
              role="navigation"
              aria-label="Main menu"
            >
              <p className="px-4 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
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
                            ? "border-l-2 border-[#2563EB] bg-[#eff6ff] pl-[10px] text-[#1e40af]"
                            : "border-l-2 border-transparent pl-[10px] text-slate-700 hover:bg-slate-100"
                        }`}
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                <li className="mt-1 border-t border-slate-200 pt-1">
                  <button
                    type="button"
                    className="block w-full rounded-lg border-l-2 border-transparent px-3 py-2.5 pl-[10px] text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
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
        <div className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold tracking-tight text-slate-900 sm:text-[15px]">
          {center}
        </div>
      ) : (
        <div className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold tracking-tight text-slate-900 sm:text-[15px]">
          {brandName}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {trailingBeforeProfile}
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white py-1 pl-1 pr-2.5 shadow-[3px_3px_10px_rgba(15,23,42,0.05)] transition hover:bg-slate-50"
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-[10px] font-bold text-white shadow-sm"
            aria-hidden
          >
            {profileLetter}
          </span>
          <span className="hidden max-w-[8rem] truncate text-xs font-medium text-slate-700 sm:inline">
            {displayName || "Account"}
          </span>
        </Link>
      </div>
    </header>
  );
}
