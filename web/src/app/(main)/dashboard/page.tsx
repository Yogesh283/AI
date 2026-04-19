"use client";

import { DashboardModeCards } from "@/components/neo/DashboardModeCards";
import { MainTopNav } from "@/components/neo/MainTopNav";

function DashboardShell() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#06080d]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(0,212,255,0.14),transparent_50%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(124,58,237,0.08),transparent_45%),radial-gradient(ellipse_60%_40%_at_0%_80%,rgba(0,212,255,0.05),transparent_40%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:48px_48px]"
        aria-hidden
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        <MainTopNav />
        <DashboardModeCards />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardShell />;
}
