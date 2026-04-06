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
import { ProductAnalyticsBootstrap } from "@/components/analytics/ProductAnalyticsBootstrap";
import { LegalDisclaimerBanner } from "@/components/legal/LegalDisclaimerBanner";
import { LegalAcceptanceModalGate } from "@/components/legal/LegalAcceptanceModalGate";
import { SupportWidget } from "@/components/support/SupportWidget";
import { GlassDock } from "@/components/layout/GlassDock";
import { AppStartupShellRemover } from "@/components/layout/AppStartupShellRemover";
import {
  BRAND,
  BRAND_NAME,
  BRAND_OG_SHARE_IMAGE,
  BRAND_SOCIAL_TAGLINE,
} from "@/lib/brand";
import { resolveBrandSocialLinks, type BrandSocialLink } from "@/lib/brand-socials";
import { parseAppSettingBool, parseAppSettingString } from "@/lib/settings/app-settings";
import { getAppSettingsMap } from "@/lib/settings/app-settings.server";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import {
  DEFAULT_MARKET_SETTINGS,
  MARKET_COOKIE_NAME,
  resolveMarketFromRequest,
  type MarketSettings,
} from "@/lib/market/market";
import { MarketPreferenceProvider } from "@/components/layout/MarketPreferenceProvider";
import { ImageOptimizationModeProvider } from "@/components/layout/ImageOptimizationModeProvider";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { normalizeRole } from "@/lib/roles";
import { normalizeImageOptimizationMode } from "@/lib/media/image-optimization-mode";
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

const metadataDescription = `${BRAND_SOCIAL_TAGLINE}. Find, list, and manage rentals with verified listings and secure messaging.`;
const STARTUP_SHELL_BACKGROUND = "#f8fafc";
const STARTUP_SHELL_CRITICAL_CSS = `
#app-startup-shell{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:${STARTUP_SHELL_BACKGROUND};pointer-events:none;opacity:1;transform:translate3d(0,0,0);transition:opacity 160ms ease,transform 160ms ease}
#app-startup-shell[data-state="removing"]{opacity:0;transform:translate3d(0,6px,0) scale(.98)}
#app-startup-shell[data-state="removed"]{opacity:0;visibility:hidden}
#app-startup-shell-icon{display:block;width:min(120px,32vw);height:min(120px,32vw);background:url('/icon-512.png') center/contain no-repeat}
`;
const ROOT_LAYOUT_SETTING_KEYS = [
  APP_SETTING_KEYS.demoBadgeEnabled,
  APP_SETTING_KEYS.demoWatermarkEnabled,
  APP_SETTING_KEYS.featuredListingsEnabled,
  APP_SETTING_KEYS.defaultMarketCountry,
  APP_SETTING_KEYS.defaultMarketCurrency,
  APP_SETTING_KEYS.marketAutoDetectEnabled,
  APP_SETTING_KEYS.marketSelectorEnabled,
  APP_SETTING_KEYS.imageOptimizationMode,
  APP_SETTING_KEYS.brandSocialInstagramUrl,
  APP_SETTING_KEYS.brandSocialYoutubeUrl,
  APP_SETTING_KEYS.brandSocialTiktokUrl,
  APP_SETTING_KEYS.brandSocialFacebookUrl,
  APP_SETTING_KEYS.brandSocialWhatsappLink,
] as const;

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
    title: BRAND_SOCIAL_TAGLINE,
    description: metadataDescription,
    url: BRAND.siteUrl,
    images: [
      {
        url: BRAND_OG_SHARE_IMAGE,
        width: 1200,
        height: 630,
        alt: BRAND_SOCIAL_TAGLINE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_SOCIAL_TAGLINE,
    description: metadataDescription,
    images: [BRAND_OG_SHARE_IMAGE],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: BRAND_NAME,
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
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const startupShellDisabled = process.env.NEXT_PUBLIC_SPLASH_SHELL_DISABLED !== "false";
  let supportPrefillName: string | null = null;
  let supportPrefillEmail: string | null = null;
  let supportPrefillRole: string | null = null;
  let navInitialAuthed = false;
  let navInitialRole: "super_admin" | "tenant" | "landlord" | "agent" | "admin" | null = null;
  let socialLinks: BrandSocialLink[] = [];
  let settingsMap = new Map<string, unknown>();

  const requestHeadersPromise = headers();
  const cookieStorePromise = cookies();

  if (hasServerSupabaseEnv()) {
    try {
      const { supabase, user } = await getServerAuthUser();
      const [resolvedSettings] = await Promise.all([
        getAppSettingsMap([...ROOT_LAYOUT_SETTING_KEYS], supabase),
      ]);
      settingsMap = resolvedSettings;
      if (user) {
        navInitialAuthed = true;
        supportPrefillEmail = user.email ?? null;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name,role")
          .eq("id", user.id)
          .maybeSingle();
        supportPrefillName = profile?.full_name ?? null;
        supportPrefillRole = normalizeRole(profile?.role);
        navInitialRole = normalizeRole(profile?.role) as typeof navInitialRole;
      }
    } catch {
      // Keep support prefill optional if auth or settings resolution fails.
      settingsMap = new Map<string, unknown>();
    }
  }

  const demoBadgeEnabled = parseAppSettingBool(
    settingsMap.get(APP_SETTING_KEYS.demoBadgeEnabled),
    true
  );
  const demoWatermarkEnabled = parseAppSettingBool(
    settingsMap.get(APP_SETTING_KEYS.demoWatermarkEnabled),
    false
  );
  const featuredListingsEnabled = parseAppSettingBool(
    settingsMap.get(APP_SETTING_KEYS.featuredListingsEnabled),
    true
  );
  const marketSettings: MarketSettings = {
    defaultCountry: parseAppSettingString(
      settingsMap.get(APP_SETTING_KEYS.defaultMarketCountry),
      DEFAULT_MARKET_SETTINGS.defaultCountry
    ).toUpperCase(),
    defaultCurrency: parseAppSettingString(
      settingsMap.get(APP_SETTING_KEYS.defaultMarketCurrency),
      DEFAULT_MARKET_SETTINGS.defaultCurrency
    ).toUpperCase(),
    autoDetectEnabled: parseAppSettingBool(
      settingsMap.get(APP_SETTING_KEYS.marketAutoDetectEnabled),
      DEFAULT_MARKET_SETTINGS.autoDetectEnabled
    ),
    selectorEnabled: parseAppSettingBool(
      settingsMap.get(APP_SETTING_KEYS.marketSelectorEnabled),
      DEFAULT_MARKET_SETTINGS.selectorEnabled
    ),
  };
  const imageOptimizationMode = normalizeImageOptimizationMode(
    settingsMap.get(APP_SETTING_KEYS.imageOptimizationMode),
    "vercel_default"
  );

  socialLinks = resolveBrandSocialLinks({
    instagram: parseAppSettingString(settingsMap.get(APP_SETTING_KEYS.brandSocialInstagramUrl), ""),
    youtube: parseAppSettingString(settingsMap.get(APP_SETTING_KEYS.brandSocialYoutubeUrl), ""),
    tiktok: parseAppSettingString(settingsMap.get(APP_SETTING_KEYS.brandSocialTiktokUrl), ""),
    facebook: parseAppSettingString(settingsMap.get(APP_SETTING_KEYS.brandSocialFacebookUrl), ""),
    whatsapp: parseAppSettingString(settingsMap.get(APP_SETTING_KEYS.brandSocialWhatsappLink), ""),
  });

  const requestHeaders = await requestHeadersPromise;
  const cookieStore = await cookieStorePromise;
  const market = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: cookieStore.get(MARKET_COOKIE_NAME)?.value ?? null,
    appSettings: marketSettings,
  });

  return (
    <html lang="en">
      {!startupShellDisabled ? (
        <head>
          <style dangerouslySetInnerHTML={{ __html: STARTUP_SHELL_CRITICAL_CSS }} />
        </head>
      ) : null}
      <body
        data-market-country={market.country}
        data-market-currency={market.currency}
        data-demo-badge-enabled={demoBadgeEnabled ? "true" : "false"}
        data-demo-watermark-enabled={demoWatermarkEnabled ? "true" : "false"}
        data-featured-listings-enabled={featuredListingsEnabled ? "true" : "false"}
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-900`}
      >
        {!startupShellDisabled ? (
          <>
            <div id="app-startup-shell" data-state="visible" aria-hidden="true">
              <span id="app-startup-shell-icon" />
            </div>
            <AppStartupShellRemover />
          </>
        ) : null}
        <ImageOptimizationModeProvider mode={imageOptimizationMode}>
          <MarketPreferenceProvider initialMarket={market}>
            <MainNav
              marketSelectorEnabled={marketSettings.selectorEnabled}
              initialAuthed={navInitialAuthed}
              initialRole={navInitialRole}
              socialLinks={socialLinks}
            />
            <SessionBootstrap />
            <ProductAnalyticsBootstrap
              measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? null}
            />
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
        </ImageOptimizationModeProvider>
      </body>
    </html>
  );
}
