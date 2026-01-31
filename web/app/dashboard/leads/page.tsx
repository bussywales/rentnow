import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import { HostLeadsListClient } from "@/components/leads/HostLeadsListClient";
import type { LeadStatus } from "@/lib/leads/types";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  thread_id?: string | null;
  status: LeadStatus;
  created_at?: string | null;
  intent?: string | null;
  properties?: { title?: string | null; city?: string | null; state_region?: string | null } | null;
  buyer?: { id?: string | null; full_name?: string | null } | null;
};

export default async function DashboardLeadsPage() {
  if (!hasServerSupabaseEnv()) return null;

  const { user, role } = await resolveServerRole();
  if (!user) redirect("/auth/login?reason=auth");

  if (role === "tenant") {
    redirect("/dashboard/messages");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listing_leads")
    .select(
      `id, thread_id, status, intent, created_at,
      properties:properties(id, title, city, state_region),
      buyer:profiles!listing_leads_buyer_id_fkey(id, full_name)`
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-600">
          New buy enquiries submitted for your listings. Open a lead to continue in Messages.
        </p>
      </div>
      <HostLeadsListClient
        leads={(data as LeadRow[]) || []}
        error={error?.message ?? null}
      />
    </div>
  );
}
