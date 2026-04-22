"use client";

import { useSiteBrand } from "@/components/SiteBrandProvider";

export function OnboardingMeetHeading() {
  const { brandName } = useSiteBrand();
  return (
    <h1 className="neo-gradient-text text-2xl font-semibold tracking-tight">
      Meet {brandName} — Your Personal AI Assistant
    </h1>
  );
}
