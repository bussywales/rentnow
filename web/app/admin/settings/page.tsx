import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/authz";
import { normalizeRole } from "@/lib/roles";
import AdminSettingsFeatureFlags from "@/components/admin/AdminSettingsFeatureFlags";
import {
  parseAppSettingBool,
  parseContactExchangeMode,
  parseAppSettingInt,
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
      APP_SETTING_KEYS.subscriptionsEnabled,
      APP_SETTING_KEYS.contactExchangeMode,
      APP_SETTING_KEYS.listingExpiryDays,
      APP_SETTING_KEYS.showExpiredListingsPublic,
      APP_SETTING_KEYS.paygEnabled,
      APP_SETTING_KEYS.paygListingFeeAmount,
      APP_SETTING_KEYS.paygFeaturedFeeAmount,
      APP_SETTING_KEYS.featuredDurationDays,
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
  ] as const;
  const settings = keys.map((key) => {
    const row = data?.find((item) => item.key === key);
    const defaultEnabled = key === APP_SETTING_KEYS.demoBadgeEnabled;
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">
          Admin-only feature flags and configuration.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Referral program</h2>
        <p className="text-sm text-slate-600">
          Configure referral depth, reward rules, tier thresholds, and reward caps.
        </p>
        <div className="mt-3">
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
      </div>
      <AdminSettingsFeatureFlags settings={settings} />
      <AdminSettingsContactExchange
        mode={contactMode}
        updatedAt={contactRow?.updated_at ?? null}
      />
      <AdminSettingsListingExpiry
        expiryDays={expiryDays}
        expiryUpdatedAt={expiryRow?.updated_at ?? null}
        showExpiredPublic={showExpiredPublic}
        showExpiredUpdatedAt={showExpiredRow?.updated_at ?? null}
      />
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
    </div>
  );
}
