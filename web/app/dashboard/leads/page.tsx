import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import { LeadInboxClient } from "@/components/leads/LeadInboxClient";
import type { LeadStatus } from "@/lib/leads/types";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  property_id: string;
  thread_id?: string | null;
  status: LeadStatus;
  created_at?: string | null;
  updated_at?: string | null;
  intent?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  financing_status?: string | null;
  timeline?: string | null;
  message?: string | null;
  contact_exchange_flags?: Record<string, unknown> | null;
  properties?: {
    id?: string | null;
    title?: string | null;
    city?: string | null;
    state_region?: string | null;
    listing_intent?: string | null;
  } | null;
  buyer?: { id?: string | null; full_name?: string | null } | null;
  lead_attributions?: {
    id?: string | null;
    client_page_id?: string | null;
    agent_user_id?: string | null;
    presenting_agent_id?: string | null;
    owner_user_id?: string | null;
    listing_id?: string | null;
    source?: string | null;
    created_at?: string | null;
    client_page?: {
      id?: string | null;
      client_slug?: string | null;
      client_name?: string | null;
      client_requirements?: string | null;
      agent_slug?: string | null;
    } | null;
  }[] | null;
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
      `id, property_id, thread_id, status, intent, budget_min, budget_max, financing_status, timeline, message, contact_exchange_flags, created_at, updated_at,
      properties:properties(id, title, city, state_region, listing_intent),
      buyer:profiles!listing_leads_buyer_id_fkey(id, full_name),
      lead_attributions:lead_attributions(id, client_page_id, agent_user_id, presenting_agent_id, owner_user_id, listing_id, source, created_at,
        client_page:agent_client_pages(id, client_slug, client_name, client_requirements, agent_slug)
      )`
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
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {error.message}
        </div>
      ) : (
        <LeadInboxClient
          leads={(data as LeadRow[]) || []}
          viewerRole={role as "landlord" | "agent"}
          viewerId={user.id}
        />
      )}
    </div>
  );
}
