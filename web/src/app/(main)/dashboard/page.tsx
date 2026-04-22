"use client";

import { DashboardModeCards } from "@/components/neo/DashboardModeCards";
import { MainTopNav } from "@/components/neo/MainTopNav";

function DashboardShell() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F5F7FA]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:10px_10px]"
        aria-hidden
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        <MainTopNav />
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
