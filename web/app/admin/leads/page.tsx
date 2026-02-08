import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { normalizeRole } from "@/lib/roles";
import { LeadInboxClient } from "@/components/leads/LeadInboxClient";
import type { LeadStatus } from "@/lib/leads/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type LeadRow = {
  id: string;
  property_id: string;
  status: LeadStatus;
  intent?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  thread_id?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  financing_status?: string | null;
  timeline?: string | null;
  message?: string | null;
  contact_exchange_flags?: Record<string, unknown> | null;
  properties?: {
    id?: string;
    title?: string | null;
    city?: string | null;
    state_region?: string | null;
    listing_intent?: string | null;
  } | null;
  buyer?: { id?: string | null; full_name?: string | null } | null;
  owner?: { id?: string | null; full_name?: string | null } | null;
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

export default async function AdminLeadsPage() {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    redirect("/forbidden");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/required?redirect=/admin/leads");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (normalizeRole(profile?.role) !== "admin") redirect("/forbidden?reason=role");

  const adminClient = createServiceRoleClient();
  const { data, error } = await adminClient
    .from("listing_leads")
    .select(
      `id, property_id, status, intent, budget_min, budget_max, financing_status, timeline, message, contact_exchange_flags, created_at, updated_at, thread_id,
      properties:properties(id, title, city, state_region, listing_intent),
      buyer:profiles!listing_leads_buyer_id_fkey(id, full_name),
      owner:profiles!listing_leads_owner_id_fkey(id, full_name),
      lead_attributions:lead_attributions(id, client_page_id, agent_user_id, presenting_agent_id, owner_user_id, listing_id, source, created_at,
        client_page:agent_client_pages(id, client_slug, client_name, client_requirements, agent_slug)
      )`
    )
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-600">Manage lead pipeline activity across all enquiries.</p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
          Back to overview
        </Link>
      </div>
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {error.message}
        </div>
      ) : (
        <LeadInboxClient
          leads={(data as LeadRow[]) || []}
          viewerRole="admin"
          viewerId={user.id}
          isAdmin
        />
      )}
    </div>
  );
}
