"use client";

import { DashboardModeCards } from "@/components/neo/DashboardModeCards";
import { NeoPageShell } from "@/components/neo/NeoPageShell";

export default function DashboardPage() {
  return (
    <NeoPageShell
      maxWidth="full"
      padded={false}
      contentClassName="flex min-h-0 flex-1 flex-col pt-0 md:pt-2"
      innerClassName="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <DashboardModeCards />
    </NeoPageShell>
  );
}
