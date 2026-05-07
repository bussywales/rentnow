import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/authz";
import { normalizeRole } from "@/lib/roles";
import AdminSettingsFeatureFlags from "@/components/admin/AdminSettingsFeatureFlags";
import {
  parseAppSettingBool,
  parseContactExchangeMode,
  parseAppSettingInt,
  parseAppSettingString,
  type ContactExchangeMode,
} from "@/lib/settings/app-settings";
import { AdminLocationConfigStatus } from "@/components/admin/AdminLocationConfigStatus";
import AdminSettingsContactExchange from "@/components/admin/AdminSettingsContactExchange";
import AdminSettingsListingExpiry from "@/components/admin/AdminSettingsListingExpiry";
import { DEFAULT_LISTING_EXPIRY_DAYS } from "@/lib/properties/expiry";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import AdminSettingsPayg from "@/components/admin/AdminSettingsPayg";
import AdminSettingsSubscriptions from "@/components/admin/AdminSettingsSubscriptions";
import {
  DEFAULT_PAYG_LISTING_FEE_AMOUNT,
  DEFAULT_TRIAL_CREDITS_AGENT,
  DEFAULT_TRIAL_CREDITS_LANDLORD,
} from "@/lib/billing/payg";
import {
  DEFAULT_FEATURED_DURATION_DAYS,
  DEFAULT_PAYG_FEATURED_FEE_AMOUNT,
} from "@/lib/billing/featured";
import Link from "next/link";
import AdminSettingsFeaturedRequests from "@/components/admin/AdminSettingsFeaturedRequests";
import { DEFAULT_FEATURED_ELIGIBILITY_SETTINGS } from "@/lib/featured/eligibility";
import AdminSettingsMarket from "@/components/admin/AdminSettingsMarket";
import { DEFAULT_MARKET_SETTINGS } from "@/lib/market/market";
import AdminSettingsBrandSocials from "@/components/admin/AdminSettingsBrandSocials";
import AdminSettingsLayout, {
  type AdminSettingsLayoutSection,
} from "@/components/admin/AdminSettingsLayout";
import AdminSettingsDemoVisibilityPolicy from "@/components/admin/AdminSettingsDemoVisibilityPolicy";
import { normalizeDemoListingsVisibilityPolicy } from "@/lib/properties/demo";
import AdminSettingsExploreV2CtaCopy from "@/components/admin/AdminSettingsExploreV2CtaCopy";
import { normalizeExploreV2CtaCopyVariant } from "@/lib/explore/explore-presentation";
import AdminSettingsImageOptimizationMode from "@/components/admin/AdminSettingsImageOptimizationMode";
import { normalizeImageOptimizationMode } from "@/lib/media/image-optimization-mode";
import AdminSettingsCanadaPaygGates from "@/components/admin/AdminSettingsCanadaPaygGates";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  if (!hasServerSupabaseEnv()) {
    redirect("/forbidden");
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forbidden");
  const role = normalizeRole(await getUserRole(supabase, user.id));
  if (role !== "admin") redirect("/forbidden");

  const { data } = await supabase
    .from("app_settings")
    .select("key, value, updated_at")
    .in("key", [
      APP_SETTING_KEYS.showTenantPhotoTrustSignals,
      APP_SETTING_KEYS.enableLocationPicker,
      APP_SETTING_KEYS.showTenantCheckinBadge,
      APP_SETTING_KEYS.requireLocationPinForPublish,
      APP_SETTING_KEYS.agentStorefrontsEnabled,
      APP_SETTING_KEYS.agentNetworkDiscoveryEnabled,
      APP_SETTING_KEYS.demoBadgeEnabled,
      APP_SETTING_KEYS.demoWatermarkEnabled,
      APP_SETTING_KEYS.demoListingsVisibilityPolicy,
      APP_SETTING_KEYS.verificationRequireEmail,
      APP_SETTING_KEYS.verificationRequirePhone,
      APP_SETTING_KEYS.verificationRequireBank,
      APP_SETTING_KEYS.alertsEmailEnabled,
      APP_SETTING_KEYS.alertsKillSwitchEnabled,
      APP_SETTING_KEYS.exploreEnabled,
      APP_SETTING_KEYS.exploreV2TrustCueEnabled,
      APP_SETTING_KEYS.exploreV2CtaCopyVariant,
      APP_SETTING_KEYS.imageOptimizationMode,
      APP_SETTING_KEYS.defaultMarketCountry,
      APP_SETTING_KEYS.defaultMarketCurrency,
      APP_SETTING_KEYS.marketAutoDetectEnabled,
      APP_SETTING_KEYS.marketSelectorEnabled,
      APP_SETTING_KEYS.canadaRentalPaygRuntimeEnabled,
      APP_SETTING_KEYS.canadaRentalPaygCheckoutSessionCreationEnabled,
      APP_SETTING_KEYS.canadaRentalPaygWebhookFulfilmentEnabled,
      APP_SETTING_KEYS.canadaRentalPaygPaymentPersistenceEnabled,
      APP_SETTING_KEYS.canadaRentalPaygEntitlementGrantEnabled,
      APP_SETTING_KEYS.canadaRentalPaygListingUnlockEnabled,
      APP_SETTING_KEYS.canadaRentalPaygEntitlementConsumeEnabled,
      APP_SETTING_KEYS.brandSocialInstagramUrl,
      APP_SETTING_KEYS.brandSocialYoutubeUrl,
      APP_SETTING_KEYS.brandSocialTiktokUrl,
      APP_SETTING_KEYS.brandSocialFacebookUrl,
      APP_SETTING_KEYS.brandSocialWhatsappLink,
      APP_SETTING_KEYS.shortletPaymentsStripeEnabled,
      APP_SETTING_KEYS.shortletPaymentsPaystackEnabled,
      APP_SETTING_KEYS.shortletAutoPayoutsEnabled,
      APP_SETTING_KEYS.listingsAutoApproveEnabled,
      APP_SETTING_KEYS.subscriptionsEnabled,
      APP_SETTING_KEYS.contactExchangeMode,
      APP_SETTING_KEYS.listingExpiryDays,
      APP_SETTING_KEYS.showExpiredListingsPublic,
      APP_SETTING_KEYS.paygEnabled,
      APP_SETTING_KEYS.paygListingFeeAmount,
      APP_SETTING_KEYS.paygFeaturedFeeAmount,
      APP_SETTING_KEYS.featuredDurationDays,
      APP_SETTING_KEYS.featuredListingsEnabled,
      APP_SETTING_KEYS.featuredRequestsEnabled,
      APP_SETTING_KEYS.featuredPrice7dMinor,
      APP_SETTING_KEYS.featuredPrice30dMinor,
      APP_SETTING_KEYS.featuredCurrency,
      APP_SETTING_KEYS.featuredReviewSlaDays,
      APP_SETTING_KEYS.featuredRequiresApprovedListing,
      APP_SETTING_KEYS.featuredRequiresActiveListing,
      APP_SETTING_KEYS.featuredRequiresNotDemo,
      APP_SETTING_KEYS.featuredMinPhotos,
      APP_SETTING_KEYS.featuredMinDescriptionChars,
      APP_SETTING_KEYS.trialListingCreditsAgent,
      APP_SETTING_KEYS.trialListingCreditsLandlord,
    ]);

  const keys = [
    APP_SETTING_KEYS.showTenantPhotoTrustSignals,
    APP_SETTING_KEYS.enableLocationPicker,
    APP_SETTING_KEYS.showTenantCheckinBadge,
    APP_SETTING_KEYS.requireLocationPinForPublish,
    APP_SETTING_KEYS.agentStorefrontsEnabled,
    APP_SETTING_KEYS.agentNetworkDiscoveryEnabled,
    APP_SETTING_KEYS.demoBadgeEnabled,
    APP_SETTING_KEYS.demoWatermarkEnabled,
    APP_SETTING_KEYS.featuredListingsEnabled,
    APP_SETTING_KEYS.verificationRequireEmail,
    APP_SETTING_KEYS.verificationRequirePhone,
    APP_SETTING_KEYS.verificationRequireBank,
    APP_SETTING_KEYS.alertsEmailEnabled,
    APP_SETTING_KEYS.alertsKillSwitchEnabled,
    APP_SETTING_KEYS.exploreEnabled,
    APP_SETTING_KEYS.exploreV2TrustCueEnabled,
    APP_SETTING_KEYS.shortletPaymentsStripeEnabled,
    APP_SETTING_KEYS.shortletPaymentsPaystackEnabled,
    APP_SETTING_KEYS.shortletAutoPayoutsEnabled,
    APP_SETTING_KEYS.listingsAutoApproveEnabled,
  ] as const;
  const settings = keys.map((key) => {
    const row = data?.find((item) => item.key === key);
    const defaultEnabled =
      key === APP_SETTING_KEYS.demoBadgeEnabled ||
      key === APP_SETTING_KEYS.featuredListingsEnabled ||
      key === APP_SETTING_KEYS.verificationRequireEmail ||
      key === APP_SETTING_KEYS.exploreEnabled ||
      key === APP_SETTING_KEYS.shortletPaymentsStripeEnabled ||
      key === APP_SETTING_KEYS.shortletPaymentsPaystackEnabled;
    return {
      key,
      enabled: parseAppSettingBool(row?.value, defaultEnabled),
      updatedAt: row?.updated_at ?? null,
    };
  });

  const contactRow = data?.find((item) => item.key === APP_SETTING_KEYS.contactExchangeMode);
  const contactMode: ContactExchangeMode = parseContactExchangeMode(
    contactRow?.value,
    "redact"
  );
  const expiryRow = data?.find((item) => item.key === APP_SETTING_KEYS.listingExpiryDays);
  const expiryDays = parseAppSettingInt(expiryRow?.value, DEFAULT_LISTING_EXPIRY_DAYS);
  const showExpiredRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.showExpiredListingsPublic
  );
  const showExpiredPublic = parseAppSettingBool(showExpiredRow?.value, false);

  const paygEnabledRow = data?.find((item) => item.key === APP_SETTING_KEYS.paygEnabled);
  const paygEnabled = parseAppSettingBool(paygEnabledRow?.value, true);
  const paygAmountRow = data?.find((item) => item.key === APP_SETTING_KEYS.paygListingFeeAmount);
  const paygAmount = parseAppSettingInt(
    paygAmountRow?.value,
    DEFAULT_PAYG_LISTING_FEE_AMOUNT
  );
  const trialAgentRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.trialListingCreditsAgent
  );
  const trialLandlordRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.trialListingCreditsLandlord
  );
  const trialAgentCredits = parseAppSettingInt(
    trialAgentRow?.value,
    DEFAULT_TRIAL_CREDITS_AGENT
  );
  const trialLandlordCredits = parseAppSettingInt(
    trialLandlordRow?.value,
    DEFAULT_TRIAL_CREDITS_LANDLORD
  );

  const subscriptionsRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.subscriptionsEnabled
  );
  const subscriptionsEnabled = parseAppSettingBool(subscriptionsRow?.value, false);

  const marketCountryRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.defaultMarketCountry
  );
  const exploreV2CtaCopyVariantRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.exploreV2CtaCopyVariant
  );
  const imageOptimizationModeRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.imageOptimizationMode
  );
  const marketCurrencyRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.defaultMarketCurrency
  );
  const marketAutoDetectRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.marketAutoDetectEnabled
  );
  const marketSelectorRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.marketSelectorEnabled
  );
  const brandSocialInstagramRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.brandSocialInstagramUrl
  );
  const brandSocialYoutubeRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.brandSocialYoutubeUrl
  );
  const brandSocialTiktokRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.brandSocialTiktokUrl
  );
  const brandSocialFacebookRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.brandSocialFacebookUrl
  );
  const brandSocialWhatsappRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.brandSocialWhatsappLink
  );

  const marketSettings = {
    defaultCountry: parseAppSettingString(
      marketCountryRow?.value,
      DEFAULT_MARKET_SETTINGS.defaultCountry
    ),
    defaultCurrency: parseAppSettingString(
      marketCurrencyRow?.value,
      DEFAULT_MARKET_SETTINGS.defaultCurrency
    ),
    autoDetectEnabled: parseAppSettingBool(
      marketAutoDetectRow?.value,
      DEFAULT_MARKET_SETTINGS.autoDetectEnabled
    ),
    selectorEnabled: parseAppSettingBool(
      marketSelectorRow?.value,
      DEFAULT_MARKET_SETTINGS.selectorEnabled
    ),
  };
  const exploreV2CtaCopyVariant = normalizeExploreV2CtaCopyVariant(
    parseAppSettingString(exploreV2CtaCopyVariantRow?.value, "default")
  );
  const imageOptimizationMode = normalizeImageOptimizationMode(
    imageOptimizationModeRow?.value,
    "vercel_default"
  );

  const brandSocialSettings = {
    instagramUrl: parseAppSettingString(brandSocialInstagramRow?.value, ""),
    youtubeUrl: parseAppSettingString(brandSocialYoutubeRow?.value, ""),
    tiktokUrl: parseAppSettingString(brandSocialTiktokRow?.value, ""),
    facebookUrl: parseAppSettingString(brandSocialFacebookRow?.value, ""),
    whatsappLink: parseAppSettingString(brandSocialWhatsappRow?.value, ""),
  };

  const canadaPaygGateKeys = [
    APP_SETTING_KEYS.canadaRentalPaygRuntimeEnabled,
    APP_SETTING_KEYS.canadaRentalPaygCheckoutSessionCreationEnabled,
    APP_SETTING_KEYS.canadaRentalPaygWebhookFulfilmentEnabled,
    APP_SETTING_KEYS.canadaRentalPaygPaymentPersistenceEnabled,
    APP_SETTING_KEYS.canadaRentalPaygEntitlementGrantEnabled,
    APP_SETTING_KEYS.canadaRentalPaygListingUnlockEnabled,
    APP_SETTING_KEYS.canadaRentalPaygEntitlementConsumeEnabled,
  ] as const;

  const canadaPaygGateSettings = canadaPaygGateKeys.map((key) => {
    const row = data?.find((item) => item.key === key);
    return {
      key,
      enabled: parseAppSettingBool(row?.value, false),
      updatedAt: row?.updated_at ?? null,
    };
  });
  const demoVisibilityPolicyRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.demoListingsVisibilityPolicy
  );
  const demoVisibilityPolicy = normalizeDemoListingsVisibilityPolicy(
    demoVisibilityPolicyRow?.value,
    "restricted"
  );

  const paygFeaturedRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.paygFeaturedFeeAmount
  );
  const paygFeaturedAmount = parseAppSettingInt(
    paygFeaturedRow?.value,
    DEFAULT_PAYG_FEATURED_FEE_AMOUNT
  );

  const featuredDurationRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredDurationDays
  );
  const featuredDurationDays = parseAppSettingInt(
    featuredDurationRow?.value,
    DEFAULT_FEATURED_DURATION_DAYS
  );

  const { data: planRows } = await supabase
    .from("plans")
    .select("id, role, tier, listing_credits, featured_credits, updated_at")
    .eq("is_active", true)
    .order("role", { ascending: true })
    .order("tier", { ascending: true });

  const featuredRequestsEnabledRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredRequestsEnabled
  );
  const featuredPrice7dRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredPrice7dMinor
  );
  const featuredPrice30dRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredPrice30dMinor
  );
  const featuredCurrencyRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredCurrency
  );
  const featuredReviewSlaRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredReviewSlaDays
  );
  const featuredRequiresApprovedRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredRequiresApprovedListing
  );
  const featuredRequiresActiveRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredRequiresActiveListing
  );
  const featuredRequiresNotDemoRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredRequiresNotDemo
  );
  const featuredMinPhotosRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredMinPhotos
  );
  const featuredMinDescriptionRow = data?.find(
    (item) => item.key === APP_SETTING_KEYS.featuredMinDescriptionChars
  );

  const featuredSettings = {
    requestsEnabled: parseAppSettingBool(
      featuredRequestsEnabledRow?.value,
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.requestsEnabled
    ),
    price7dMinor: parseAppSettingInt(
      featuredPrice7dRow?.value,
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.price7dMinor
    ),
    price30dMinor: parseAppSettingInt(
      featuredPrice30dRow?.value,
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.price30dMinor
    ),
    currency: parseAppSettingString(
      featuredCurrencyRow?.value,
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.currency
    ),
    reviewSlaDays: parseAppSettingInt(
      featuredReviewSlaRow?.value,
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.reviewSlaDays
    ),
    requiresApprovedListing: parseAppSettingBool(
      featuredRequiresApprovedRow?.value,
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.requiresApprovedListing
    ),
    requiresActiveListing: parseAppSettingBool(
      featuredRequiresActiveRow?.value,
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.requiresActiveListing
    ),
    requiresNotDemo: parseAppSettingBool(
      featuredRequiresNotDemoRow?.value,
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.requiresNotDemo
    ),
    minPhotos: parseAppSettingInt(
      featuredMinPhotosRow?.value,
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.minPhotos
    ),
    minDescriptionChars: parseAppSettingInt(
      featuredMinDescriptionRow?.value,
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.minDescriptionChars
    ),
  };

  const groups: AdminSettingsLayoutSection[] = [
    {
      id: "referral-program",
      title: "Referral program",
      description: "Configure referral depth, reward rules, tier thresholds, and payout operations.",
      keywords: ["referral", "rewards", "thresholds", "simulator", "payouts"],
      content: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-4">
            <Link
              href="/admin/settings/referrals"
              className="text-sm font-semibold text-slate-900 underline underline-offset-4"
            >
              Open referral settings
            </Link>
            <Link
              href="/admin/referrals/simulator"
              className="text-sm font-semibold text-slate-900 underline underline-offset-4"
            >
              Open simulator
            </Link>
            <Link
              href="/admin/referrals/payouts"
              className="text-sm font-semibold text-slate-900 underline underline-offset-4"
            >
              Open payouts queue
            </Link>
          </div>
        </div>
      ),
    },
    {
      id: "feature-toggles",
      title: "Feature toggles",
      description: "Global feature switches and guard toggles for tenant, host, and admin surfaces.",
      keywords: ["feature", "toggle", "alerts", "verification", "explore", "shortlet"],
      content: <AdminSettingsFeatureFlags settings={settings} />,
    },
    {
      id: "image-optimisation",
      title: "Image optimisation mode",
      description: "Operational control for shared image optimisation when transform usage spikes.",
      keywords: ["images", "optimisation", "unoptimized", "vercel", "ops", "media"],
      content: (
        <AdminSettingsImageOptimizationMode
          mode={imageOptimizationMode}
          updatedAt={imageOptimizationModeRow?.updated_at ?? null}
        />
      ),
    },
    {
      id: "explore-v2-cta-copy",
      title: "Explore V2 CTA copy",
      description: "Variant control for the Explore V2 micro-sheet primary CTA experiment.",
      keywords: ["explore", "v2", "cta", "copy", "experiment", "conversion"],
      content: (
        <AdminSettingsExploreV2CtaCopy
          variant={exploreV2CtaCopyVariant}
          updatedAt={exploreV2CtaCopyVariantRow?.updated_at ?? null}
        />
      ),
    },
    {
      id: "demo-visibility",
      title: "Demo visibility policy",
      description:
        "Controls whether demo listings are public to everyone or restricted to admin/host viewers.",
      keywords: ["demo", "visibility", "restricted", "public", "listings"],
      content: (
        <AdminSettingsDemoVisibilityPolicy
          policy={demoVisibilityPolicy}
          updatedAt={demoVisibilityPolicyRow?.updated_at ?? null}
        />
      ),
    },
    {
      id: "market-defaults",
      title: "Market defaults",
      description: "Default country/currency settings and market auto-detection behavior.",
      keywords: ["market", "country", "currency", "selector", "auto-detect"],
      content: (
        <AdminSettingsMarket
          settings={marketSettings}
          updatedAt={{
            defaultCountry: marketCountryRow?.updated_at ?? null,
            defaultCurrency: marketCurrencyRow?.updated_at ?? null,
            autoDetectEnabled: marketAutoDetectRow?.updated_at ?? null,
            selectorEnabled: marketSelectorRow?.updated_at ?? null,
          }}
        />
      ),
    },
    {
      id: "brand-socials",
      title: "Brand & socials",
      description: "Public-facing social links used in the footer and navigation surfaces.",
      keywords: ["brand", "social", "instagram", "youtube", "tiktok", "facebook", "whatsapp"],
      content: (
        <AdminSettingsBrandSocials
          settings={brandSocialSettings}
          updatedAt={{
            instagramUrl: brandSocialInstagramRow?.updated_at ?? null,
            youtubeUrl: brandSocialYoutubeRow?.updated_at ?? null,
            tiktokUrl: brandSocialTiktokRow?.updated_at ?? null,
            facebookUrl: brandSocialFacebookRow?.updated_at ?? null,
            whatsappLink: brandSocialWhatsappRow?.updated_at ?? null,
          }}
        />
      ),
    },
    {
      id: "canada-payg-test-mode-gates",
      title: "Canada PAYG test-mode gates",
      description:
        "Operator-only gate controls for guarded Canada Stripe test-mode validation. Submit unlock stays disabled.",
      keywords: [
        "canada",
        "payg",
        "stripe",
        "test-mode",
        "runtime",
        "webhook",
        "entitlement",
        "unlock",
      ],
      content: <AdminSettingsCanadaPaygGates settings={canadaPaygGateSettings} />,
    },
    {
      id: "featured-thresholds",
      title: "Featured thresholds",
      description: "Pricing visibility and eligibility guardrails for featured requests.",
      keywords: ["featured", "requests", "pricing", "sla", "eligibility", "photos", "description"],
      content: (
        <AdminSettingsFeaturedRequests
          settings={featuredSettings}
          updatedAt={{
            requestsEnabled: featuredRequestsEnabledRow?.updated_at ?? null,
            price7dMinor: featuredPrice7dRow?.updated_at ?? null,
            price30dMinor: featuredPrice30dRow?.updated_at ?? null,
            currency: featuredCurrencyRow?.updated_at ?? null,
            reviewSlaDays: featuredReviewSlaRow?.updated_at ?? null,
            requiresApprovedListing: featuredRequiresApprovedRow?.updated_at ?? null,
            requiresActiveListing: featuredRequiresActiveRow?.updated_at ?? null,
            requiresNotDemo: featuredRequiresNotDemoRow?.updated_at ?? null,
            minPhotos: featuredMinPhotosRow?.updated_at ?? null,
            minDescriptionChars: featuredMinDescriptionRow?.updated_at ?? null,
          }}
        />
      ),
    },
    {
      id: "contact-exchange",
      title: "Contact exchange protection",
      description: "Controls if contact details are redacted or blocked in message surfaces.",
      keywords: ["contact", "redact", "block", "messages", "protection"],
      content: (
        <AdminSettingsContactExchange
          mode={contactMode}
          updatedAt={contactRow?.updated_at ?? null}
        />
      ),
    },
    {
      id: "listing-expiry",
      title: "Listing expiry",
      description: "Listing lifetime controls and public visibility rules for expired listings.",
      keywords: ["listing", "expiry", "expired", "public", "visibility"],
      content: (
        <AdminSettingsListingExpiry
          expiryDays={expiryDays}
          expiryUpdatedAt={expiryRow?.updated_at ?? null}
          showExpiredPublic={showExpiredPublic}
          showExpiredUpdatedAt={showExpiredRow?.updated_at ?? null}
        />
      ),
    },
    {
      id: "payg-fees",
      title: "Pay-as-you-go fees",
      description: "PAYG listing fee controls and trial credits for new account onboarding.",
      keywords: ["payg", "listing fee", "trial credits", "agents", "landlords"],
      content: (
        <AdminSettingsPayg
          paygEnabled={paygEnabled}
          paygAmount={paygAmount}
          paygUpdatedAt={paygEnabledRow?.updated_at ?? null}
          amountUpdatedAt={paygAmountRow?.updated_at ?? null}
          trialAgentCredits={trialAgentCredits}
          trialLandlordCredits={trialLandlordCredits}
          trialAgentUpdatedAt={trialAgentRow?.updated_at ?? null}
          trialLandlordUpdatedAt={trialLandlordRow?.updated_at ?? null}
        />
      ),
    },
    {
      id: "subscriptions-credits",
      title: "Subscriptions & featured credits",
      description: "Subscriptions toggle, featured fees, durations, and monthly credit bundles.",
      keywords: ["subscriptions", "credits", "plans", "featured", "duration", "fees"],
      content: (
        <AdminSettingsSubscriptions
          subscriptionsEnabled={subscriptionsEnabled}
          subscriptionsUpdatedAt={subscriptionsRow?.updated_at ?? null}
          paygFeaturedAmount={paygFeaturedAmount}
          paygFeaturedUpdatedAt={paygFeaturedRow?.updated_at ?? null}
          featuredDurationDays={featuredDurationDays}
          featuredDurationUpdatedAt={featuredDurationRow?.updated_at ?? null}
          plans={(planRows as Array<{
            id: string;
            role: string | null;
            tier: string | null;
            listing_credits: number | null;
            featured_credits: number | null;
            updated_at?: string | null;
          }>) ?? []}
        />
      ),
    },
    {
      id: "location-configuration",
      title: "Location configuration",
      description: "Operational checks for location flags and Mapbox token wiring.",
      keywords: ["location", "mapbox", "geocode", "pin", "picker"],
      content: (
        <AdminLocationConfigStatus
          flags={{
            enable_location_picker:
              settings.find((s) => s.key === APP_SETTING_KEYS.enableLocationPicker)?.enabled ??
              false,
            require_location_pin_for_publish:
              settings.find((s) => s.key === APP_SETTING_KEYS.requireLocationPinForPublish)
                ?.enabled ?? false,
            show_tenant_checkin_badge:
              settings.find((s) => s.key === APP_SETTING_KEYS.showTenantCheckinBadge)?.enabled ??
              false,
          }}
          env={{
            mapboxServerConfigured: !!process.env.MAPBOX_TOKEN,
            mapboxClientConfigured: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
          }}
        />
      ),
    },
  ];

  return (
    <div
      className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-4"
      data-testid="admin-settings-page"
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">
          Admin-only feature flags and configuration.
        </p>
      </div>
      <AdminSettingsLayout sections={groups} />
    </div>
  );
}
