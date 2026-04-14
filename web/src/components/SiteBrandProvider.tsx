"use client";

import { createContext, useContext, useMemo } from "react";

type SiteBrandContextValue = { brandName: string };

const SiteBrandContext = createContext<SiteBrandContextValue>({
  brandName: "NeoXAI",
});

export function SiteBrandProvider({
  children,
  brandName,
}: {
  children: React.ReactNode;
  brandName: string;
}) {
  const value = useMemo(
    () => ({ brandName: brandName.trim() || "NeoXAI" }),
    [brandName]
  );
  return (
    <SiteBrandContext.Provider value={value}>{children}</SiteBrandContext.Provider>
  );
}

export function useSiteBrand(): SiteBrandContextValue {
  return useContext(SiteBrandContext);
}
