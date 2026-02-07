import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { MainNav } from "@/components/layout/MainNav";
import { Footer } from "@/components/layout/Footer";
import { ToastNotice } from "@/components/layout/ToastNotice";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";
import { PwaServiceWorker } from "@/components/layout/PwaServiceWorker";
import { SessionBootstrap } from "@/components/analytics/SessionBootstrap";
import { LegalDisclaimerBanner } from "@/components/legal/LegalDisclaimerBanner";
import { LegalAcceptanceModalGate } from "@/components/legal/LegalAcceptanceModalGate";
import {
  BRAND,
  BRAND_NAME,
  BRAND_OG_IMAGE,
} from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

const metadataDescription =
  "Find, list, and manage rentals across Africa with verified listings and secure messaging.";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: metadataDescription,
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    description: metadataDescription,
    url: BRAND.siteUrl,
    images: [
      {
        url: BRAND_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME,
    description: metadataDescription,
    images: [BRAND_OG_IMAGE],
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-900`}
      >
        <MainNav />
        <SessionBootstrap />
        <LegalAcceptanceModalGate />
        <Suspense fallback={null}>
          <ToastNotice />
        </Suspense>
        <OfflineIndicator />
        <PwaServiceWorker />
        <main className="min-h-[80vh] pb-24 pt-6">{children}</main>
        <Footer />
        <LegalDisclaimerBanner />
      </body>
    </html>
  );
}
