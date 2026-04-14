"use client";

import { useSiteBrand } from "@/components/SiteBrandProvider";

export function OnboardingMeetHeading() {
  const { brandName } = useSiteBrand();
  return (
    <h1 className="text-2xl font-semibold tracking-tight text-white">
      Meet {brandName} — Your Personal AI Companion
    </h1>
  );
}
