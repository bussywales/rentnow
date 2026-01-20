import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/authz";
import { normalizeRole } from "@/lib/roles";
import AdminSettingsFeatureFlags from "@/components/admin/AdminSettingsFeatureFlags";
import { parseAppSettingBool } from "@/lib/settings/app-settings";
import { AdminLocationConfigStatus } from "@/components/admin/AdminLocationConfigStatus";

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
    ]);

  const keys = [
    "show_tenant_photo_trust_signals",
    "enable_location_picker",
    "show_tenant_checkin_badge",
    "require_location_pin_for_publish",
  ] as const;
  const settings = keys.map((key) => {
    const row = data?.find((item) => item.key === key);
    return {
      key,
      enabled: parseAppSettingBool(row?.value, false),
      updatedAt: row?.updated_at ?? null,
    };
  });
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">
          Admin-only feature flags and configuration.
        </p>
      </div>
      <AdminSettingsFeatureFlags settings={settings} />
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
