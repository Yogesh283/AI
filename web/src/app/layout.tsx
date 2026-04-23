import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { headers } from "next/headers";
import { SiteBrandProvider } from "@/components/SiteBrandProvider";
import { Providers } from "./providers";
import { resolveSiteDisplayName } from "@/lib/siteBranding";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

async function requestHost(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-host") ?? h.get("host") ?? "").trim();
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await requestHost();
  const brand = resolveSiteDisplayName(host);
  return {
    title: {
      default: `${brand} — Your AI Assistant`,
      template: `%s | ${brand}`,
    },
    description: `Your personal AI assistant — chat, voice, and memory. ${brand}.`,
    icons: {
      icon: "/logo.jpeg",
      shortcut: "/logo.jpeg",
      apple: "/logo.jpeg",
    },
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
      <body
        className={`${montserrat.className} min-h-full overflow-x-hidden font-sans selection:bg-[#6A5CFF]/28 selection:text-white`}
      >
        <SiteBrandProvider brandName={brandName}>
          <Providers>{children}</Providers>
        </SiteBrandProvider>
      </body>
    </html>
  );
}
