import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import AgentCollaborationsClient from "@/components/agents/AgentCollaborationsClient";

export const dynamic = "force-dynamic";

export default async function AgentCollaborationsPage() {
  if (!hasServerSupabaseEnv()) {
    redirect("/forbidden");
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    redirect("/auth/login?reason=auth&redirect=/dashboard/collaborations");
  }
  if (role !== "agent") {
    redirect("/forbidden?reason=role");
  }

  const supabase = await createServerSupabaseClient();
  const { data: agreements } = await supabase
    .from("agent_commission_agreements")
    .select(
      "id, listing_id, owner_agent_id, presenting_agent_id, commission_type, commission_value, currency, status, notes, created_at, accepted_at, declined_at, voided_at, void_reason, terms_locked, terms_locked_at"
    )
    .or(`owner_agent_id.eq.${user.id},presenting_agent_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  type AgreementRow = {
    id: string;
    listing_id: string;
    owner_agent_id: string;
    presenting_agent_id: string;
    commission_type?: string | null;
    commission_value?: number | null;
    currency?: string | null;
    status?: string | null;
    notes?: string | null;
    created_at?: string | null;
    accepted_at?: string | null;
    declined_at?: string | null;
    voided_at?: string | null;
    void_reason?: string | null;
    terms_locked?: boolean | null;
    terms_locked_at?: string | null;
  };

  const agreementRows = (agreements as AgreementRow[] | null) ?? [];
  const listingIds = Array.from(new Set(agreementRows.map((row) => row.listing_id)));
  const profileIds = Array.from(
    new Set(
      agreementRows.flatMap((row) => [row.owner_agent_id, row.presenting_agent_id])
    )
  );

  const { data: listings } = listingIds.length
    ? await supabase
        .from("properties")
        .select("id, title, city, price, currency")
        .in("id", listingIds)
    : { data: [] };

  const { data: profiles } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, display_name, business_name")
        .in("id", profileIds)
    : { data: [] };

  const agreementIds = agreementRows.map((row) => row.id);
  const { data: events } = agreementIds.length
    ? await supabase
        .from("agent_commission_events")
        .select("agreement_id, event, created_at")
        .in("agreement_id", agreementIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  type ListingRow = {
    id: string;
    title?: string | null;
    city?: string | null;
    price?: number | null;
    currency?: string | null;
  };

  type ProfileRow = {
    id: string;
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
  };

  type EventRow = {
    agreement_id: string;
    event?: string | null;
    created_at?: string | null;
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Collaborations</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Commission agreements</h1>
        <p className="mt-2 text-sm text-slate-600">
          Track shared listings and keep commission notes in one place.
        </p>
      </header>
      <AgentCollaborationsClient
        agreements={agreementRows}
        listings={(listings as ListingRow[] | null) ?? []}
        profiles={(profiles as ProfileRow[] | null) ?? []}
        events={(events as EventRow[] | null) ?? []}
        viewerId={user.id}
      />
    </div>
  );
}
