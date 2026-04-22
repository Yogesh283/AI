"use client";

import { Suspense } from "react";
import { DashboardChatPanel } from "@/components/neo/DashboardChatPanel";
import { MainTopNav } from "@/components/neo/MainTopNav";

function ChatShell() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MainTopNav />

      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center bg-[#F5F7FA] p-12 text-sm text-slate-600">
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

export default function ChatPage() {
  return <ChatShell />;
}
