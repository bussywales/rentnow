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
      "show_tenant_photo_trust_signals",
      "enable_location_picker",
      "show_tenant_checkin_badge",
      "require_location_pin_for_publish",
      "agent_storefronts_enabled",
      "contact_exchange_mode",
      "listing_expiry_days",
      "show_expired_listings_public",
    ]);

  const keys = [
    "show_tenant_photo_trust_signals",
    "enable_location_picker",
    "show_tenant_checkin_badge",
    "require_location_pin_for_publish",
    "agent_storefronts_enabled",
  ] as const;
  const settings = keys.map((key) => {
    const row = data?.find((item) => item.key === key);
    return {
      key,
      enabled: parseAppSettingBool(row?.value, false),
      updatedAt: row?.updated_at ?? null,
    };
  });

  const contactRow = data?.find((item) => item.key === "contact_exchange_mode");
  const contactMode: ContactExchangeMode = parseContactExchangeMode(
    contactRow?.value,
    "redact"
  );
  const expiryRow = data?.find((item) => item.key === "listing_expiry_days");
  const expiryDays = parseAppSettingInt(expiryRow?.value, DEFAULT_LISTING_EXPIRY_DAYS);
  const showExpiredRow = data?.find((item) => item.key === "show_expired_listings_public");
  const showExpiredPublic = parseAppSettingBool(showExpiredRow?.value, false);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">
          Admin-only feature flags and configuration.
        </p>
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
      <AdminLocationConfigStatus
        flags={{
          enable_location_picker: settings.find((s) => s.key === "enable_location_picker")?.enabled ?? false,
          require_location_pin_for_publish:
            settings.find((s) => s.key === "require_location_pin_for_publish")?.enabled ?? false,
          show_tenant_checkin_badge:
            settings.find((s) => s.key === "show_tenant_checkin_badge")?.enabled ?? false,
        }}
        env={{
          mapboxServerConfigured: !!process.env.MAPBOX_TOKEN,
          mapboxClientConfigured: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
        }}
      />
    </div>
  );
}
