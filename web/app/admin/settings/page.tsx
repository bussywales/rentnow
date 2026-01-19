import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/authz";
import { normalizeRole } from "@/lib/roles";
import AdminSettingsFeatureFlags from "@/components/admin/AdminSettingsFeatureFlags";

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
    .eq("key", "show_tenant_photo_trust_signals")
    .maybeSingle();

  const enabled =
    typeof data?.value === "object" && data.value !== null && "enabled" in data.value
      ? (data.value as { enabled?: boolean }).enabled === true
      : false;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <AdminSettingsFeatureFlags
        initialEnabled={enabled}
        updatedAt={data?.updated_at ?? null}
      />
    </div>
  );
}
