"use client";

import { Suspense } from "react";
import { DashboardChatPanel } from "@/components/neo/DashboardChatPanel";
import { MainTopNav } from "@/components/neo/MainTopNav";

function DashboardShell() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MainTopNav />

      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center bg-[#080a0f] p-12 text-sm text-white/45">
              Loading…
            </div>
          }
        >
          <DashboardChatPanel />
        </Suspense>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardShell />;
}
