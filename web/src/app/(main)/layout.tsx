"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/neo/AppSidebar";
import { NeoBackground } from "@/components/neo/NeoBackground";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  const isChat = path === "/dashboard" || path === "/chat";
  return (
    <div className="relative min-h-[100dvh] pb-[env(safe-area-inset-bottom,0px)]">
      <NeoBackground stars={12} />
      <div
        className={`relative z-[1] flex min-h-0 ${
          isChat
            ? "h-[100dvh] max-h-[100dvh] overflow-hidden"
            : "min-h-[100dvh] md:h-[100dvh] md:max-h-[100dvh] md:overflow-hidden"
        }`}
      >
        <AppSidebar />
        <main
          className={`relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#0b0f16]/75 pt-[env(safe-area-inset-top,0px)] md:pt-0 ${
            isChat
              ? "h-full max-h-full overflow-hidden overscroll-none"
              : "overflow-y-auto"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
