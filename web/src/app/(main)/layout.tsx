"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/neo/AppSidebar";
import { BottomNav } from "@/components/neo/BottomNav";
import { NeoBackground } from "@/components/neo/NeoBackground";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  const isChat = path === "/chat";
  return (
    <div className="relative min-h-[100dvh] pb-28 md:pb-0">
      <NeoBackground stars={12} />
      <div className="neo-bottom-wave" aria-hidden />
      <div className="relative z-[1] flex min-h-[100dvh] md:h-[100dvh] md:max-h-[100dvh] md:overflow-hidden">
        <AppSidebar />
        <main
          className={`relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#0b0e14]/55 pt-[env(safe-area-inset-top,0px)] md:pt-0 ${
            isChat ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
