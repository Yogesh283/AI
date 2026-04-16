"use client";

import { DashboardModeCards } from "@/components/neo/DashboardModeCards";
import { MainTopNav } from "@/components/neo/MainTopNav";

function DashboardShell() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#080a0f]">
      <MainTopNav />
      <DashboardModeCards />
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardShell />;
}
