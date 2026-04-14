"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";

export function Providers({ children }: { children: React.ReactNode }) {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!id) return <>{children}</>;
  return <GoogleOAuthProvider clientId={id}>{children}</GoogleOAuthProvider>;
}
