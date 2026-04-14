import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteBrandProvider } from "@/components/SiteBrandProvider";
import { Providers } from "./providers";
import { resolveSiteDisplayName } from "@/lib/siteBranding";
import "./globals.css";

async function requestHost(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-host") ?? h.get("host") ?? "").trim();
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await requestHost();
  const brand = resolveSiteDisplayName(host);
  return {
    title: {
      default: `${brand} — Your AI Companion`,
      template: `%s | ${brand}`,
    },
    description: `Chat, voice, and memory — ${brand}.`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = await requestHost();
  const brandName = resolveSiteDisplayName(host);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full overflow-x-hidden font-sans selection:bg-[#00D4FF]/25 selection:text-white">
        <SiteBrandProvider brandName={brandName}>
          <Providers>{children}</Providers>
        </SiteBrandProvider>
      </body>
    </html>
  );
}
