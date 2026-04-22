"use client";

import { DashboardModeCards } from "@/components/neo/DashboardModeCards";
import { MainTopNav } from "@/components/neo/MainTopNav";
import { NeoDashboardRibbonBanner } from "@/components/neo/NeoDashboardRibbonBanner";

function DashboardShell() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#050505]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.14)_0.5px,transparent_1px)] [background-size:3px_3px]"
        aria-hidden
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        <MainTopNav />
        <NeoDashboardRibbonBanner />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DashboardModeCards />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardShell />;
}
