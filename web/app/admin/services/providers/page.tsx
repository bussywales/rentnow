import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { AdminMoveReadyProviderManager } from "@/components/services/AdminMoveReadyProviderManager";

export const dynamic = "force-dynamic";

type ProviderRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  verification_state: string;
  provider_status: string;
  notes: string | null;
  move_ready_provider_categories?: Array<{ category: string | null }> | null;
  move_ready_provider_areas?: Array<{ market_code: string; city: string | null; area: string | null }> | null;
};

export default async function AdminMoveReadyProvidersPage() {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return <div className="p-6 text-sm text-slate-600">Services admin is unavailable.</div>;
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/services/providers&reason=auth");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");

  const client = createServiceRoleClient();
  const { data } = await client
    .from("move_ready_service_providers")
    .select(
      "id,business_name,contact_name,email,phone,verification_state,provider_status,notes,move_ready_provider_categories(category),move_ready_provider_areas(market_code,city,area)"
    )
    .order("created_at", { ascending: false });

  const providers = ((data ?? []) as ProviderRow[]).map((row) => ({
    id: row.id,
    businessName: row.business_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    verificationState: row.verification_state,
    providerStatus: row.provider_status,
    notes: row.notes,
    categories: (row.move_ready_provider_categories ?? [])
      .map((entry) => entry.category || "")
      .filter(Boolean),
    serviceAreas: (row.move_ready_provider_areas ?? []).map((area) => ({
      marketCode: area.market_code,
      city: area.city,
      area: area.area,
    })),
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Move &amp; Ready providers</h1>
        <p className="text-sm text-slate-600">
          Curated, manually approved providers only. No open directory behaviour.
        </p>
      </div>
      <AdminMoveReadyProviderManager providers={providers} />
    </div>
  );
}
