"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { useEffect, useState } from "react";
import { fetchGoogleWebClientId } from "@/lib/googleClientId";

export function Providers({ children }: { children: React.ReactNode }) {
  const buildId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  const [clientId, setClientId] = useState(buildId);

  useEffect(() => {
    if (buildId) return;
    let cancelled = false;
    void fetchGoogleWebClientId().then((id) => {
      if (!cancelled && id) setClientId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [buildId]);

  if (!clientId) return <>{children}</>;
  /* key: remount GSI when client id arrives from fetch — avoids stale init in APK WebView. */
  return (
    <GoogleOAuthProvider key={clientId} clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
}
