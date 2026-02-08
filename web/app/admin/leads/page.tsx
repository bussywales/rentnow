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
  presenting_agent_profile?: {
    id?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
  } | null;
  commission_agreement?: {
    id?: string | null;
    listing_id?: string | null;
    presenting_agent_id?: string | null;
    status?: string | null;
    commission_type?: string | null;
    commission_value?: number | null;
    currency?: string | null;
  } | null;
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

  const rows = ((data as LeadRow[]) || []).map((row) => ({ ...row }));

  const attributionPairs = rows
    .map((row) => {
      const attr = row.lead_attributions?.[0];
      if (!attr?.presenting_agent_id) return null;
      return {
        presenting_agent_id: attr.presenting_agent_id,
        listing_id: attr.listing_id ?? row.property_id,
      };
    })
    .filter(Boolean) as { presenting_agent_id: string; listing_id: string }[];

  const presentingIds = Array.from(
    new Set(attributionPairs.map((pair) => pair.presenting_agent_id))
  );
  const listingIds = Array.from(new Set(attributionPairs.map((pair) => pair.listing_id)));

  const { data: presentingProfiles } = presentingIds.length
    ? await adminClient
        .from("profiles")
        .select("id, full_name, display_name, business_name")
        .in("id", presentingIds)
    : { data: [] };

  type PresentingProfile = {
    id: string;
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
  };

  const presentingMap = new Map(
    ((presentingProfiles as PresentingProfile[] | null) ?? []).map((profile) => [
      profile.id,
      profile,
    ])
  );

  const { data: agreements } = listingIds.length
    ? await adminClient
        .from("agent_commission_agreements")
        .select("id, listing_id, presenting_agent_id, status, commission_type, commission_value, currency")
        .in("listing_id", listingIds)
    : { data: [] };

  type AgreementRow = {
    id: string;
    listing_id: string;
    presenting_agent_id: string;
    status?: string | null;
    commission_type?: string | null;
    commission_value?: number | null;
    currency?: string | null;
  };

  const agreementMap = new Map(
    ((agreements as AgreementRow[] | null) ?? []).map((agreement) => [
      `${agreement.listing_id}:${agreement.presenting_agent_id}`,
      agreement,
    ])
  );

  const enrichedLeads = rows.map((lead) => {
    const attr = lead.lead_attributions?.[0];
    const presentingId = attr?.presenting_agent_id ?? null;
    const listingId = attr?.listing_id ?? lead.property_id;
    const agreement =
      presentingId && listingId
        ? agreementMap.get(`${listingId}:${presentingId}`) ?? null
        : null;
    return {
      ...lead,
      presenting_agent_profile: presentingId ? presentingMap.get(presentingId) ?? null : null,
      commission_agreement: agreement ?? null,
    };
  });

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
          leads={enrichedLeads}
          viewerRole="admin"
          viewerId={user.id}
          isAdmin
        />
      )}
    </div>
  );
}
