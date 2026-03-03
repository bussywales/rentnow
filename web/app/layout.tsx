import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { headers, cookies } from "next/headers";
import { MainNav } from "@/components/layout/MainNav";
import { Footer } from "@/components/layout/Footer";
import { ToastNotice } from "@/components/layout/ToastNotice";
import { MarketSwitchToast } from "@/components/market/MarketSwitchToast";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";
import { PwaServiceWorker } from "@/components/layout/PwaServiceWorker";
import { SessionBootstrap } from "@/components/analytics/SessionBootstrap";
import { LegalDisclaimerBanner } from "@/components/legal/LegalDisclaimerBanner";
import { LegalAcceptanceModalGate } from "@/components/legal/LegalAcceptanceModalGate";
import { SupportWidget } from "@/components/support/SupportWidget";
import { GlassDock } from "@/components/layout/GlassDock";
import {
  BRAND,
  BRAND_NAME,
  BRAND_OG_IMAGE,
} from "@/lib/brand";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getMarketSettings } from "@/lib/market/market.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";
import { MarketPreferenceProvider } from "@/components/layout/MarketPreferenceProvider";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { normalizeRole } from "@/lib/roles";
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
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let supportPrefillName: string | null = null;
  let supportPrefillEmail: string | null = null;
  let supportPrefillRole: string | null = null;

  if (hasServerSupabaseEnv()) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        supportPrefillEmail = user.email ?? null;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name,role")
          .eq("id", user.id)
          .maybeSingle();
        supportPrefillName = profile?.full_name ?? null;
        supportPrefillRole = normalizeRole(profile?.role);
      }
    } catch {
      // Keep support prefill optional if auth resolution fails.
    }
  }

  const demoBadgeEnabled = await getAppSettingBool(APP_SETTING_KEYS.demoBadgeEnabled, true);
  const demoWatermarkEnabled = await getAppSettingBool(
    APP_SETTING_KEYS.demoWatermarkEnabled,
    false
  );
  const featuredListingsEnabled = await getAppSettingBool(
    APP_SETTING_KEYS.featuredListingsEnabled,
    true
  );
  const marketSettings = await getMarketSettings();
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const market = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: cookieStore.get(MARKET_COOKIE_NAME)?.value ?? null,
    appSettings: marketSettings,
  });

  return (
    <html lang="en">
      <body
        data-market-country={market.country}
        data-market-currency={market.currency}
        data-demo-badge-enabled={demoBadgeEnabled ? "true" : "false"}
        data-demo-watermark-enabled={demoWatermarkEnabled ? "true" : "false"}
        data-featured-listings-enabled={featuredListingsEnabled ? "true" : "false"}
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-900`}
      >
        <MarketPreferenceProvider initialMarket={market}>
          <MainNav marketSelectorEnabled={marketSettings.selectorEnabled} />
          <SessionBootstrap />
          <LegalAcceptanceModalGate />
          <Suspense fallback={null}>
            <ToastNotice />
          </Suspense>
          <MarketSwitchToast />
          <OfflineIndicator />
          <PwaServiceWorker />
          <main className="min-h-[80vh] pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] pt-6 md:pb-24">
            {children}
          </main>
          <SupportWidget
            prefillName={supportPrefillName}
            prefillEmail={supportPrefillEmail}
            prefillRole={supportPrefillRole}
          />
          <GlassDock />
          <Footer />
          <LegalDisclaimerBanner />
        </MarketPreferenceProvider>
      </body>
    </html>
  );
}
