import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import AgreementSummaryClient from "@/components/agents/AgreementSummaryClient";
import { formatRelativeTime } from "@/lib/date/relative-time";

const LEGAL_COPY =
  "PropatyHub only records this agreement; payment is handled off-platform.";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id?: string }> };

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
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  business_name?: string | null;
};

type ListingRow = {
  id: string;
  title?: string | null;
  city?: string | null;
  price?: number | null;
  currency?: string | null;
};

function resolveName(profile?: ProfileRow | null) {
  return profile?.display_name || profile?.full_name || profile?.business_name || "Agent";
}

function formatCommission(agreement: AgreementRow) {
  if (agreement.commission_type === "none") return "None";
  if (agreement.commission_type === "percentage") {
    return agreement.commission_value != null ? `${agreement.commission_value}%` : "Percentage";
  }
  if (agreement.commission_type === "fixed") {
    const currency = agreement.currency || "NGN";
    return agreement.commission_value != null ? `${currency} ${agreement.commission_value}` : "Fixed";
  }
  return "—";
}

export default async function AgreementSummaryPage({ params }: RouteContext) {
  if (!hasServerSupabaseEnv()) {
    redirect("/forbidden");
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    redirect("/auth/login?reason=auth&redirect=/dashboard/collaborations");
  }

  const resolved = await params;
  const agreementId = resolved?.id;
  if (!agreementId) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: agreement } = await supabase
    .from("agent_commission_agreements")
    .select(
      "id, listing_id, owner_agent_id, presenting_agent_id, commission_type, commission_value, currency, status, notes, created_at, accepted_at, declined_at, voided_at, void_reason"
    )
    .eq("id", agreementId)
    .maybeSingle();

  if (!agreement) {
    notFound();
  }

  const isOwner = agreement.owner_agent_id === user.id;
  const isPresenting = agreement.presenting_agent_id === user.id;
  const isAdmin = role === "admin";

  if (!isOwner && !isPresenting && !isAdmin) {
    notFound();
  }

  const { data: listing } = await supabase
    .from("properties")
    .select("id, title, city, price, currency")
    .eq("id", agreement.listing_id)
    .maybeSingle();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, business_name")
    .in("id", [agreement.owner_agent_id, agreement.presenting_agent_id]);

  const ownerProfile = (profiles as ProfileRow[] | null)?.find(
    (profile) => profile.id === agreement.owner_agent_id
  );
  const presentingProfile = (profiles as ProfileRow[] | null)?.find(
    (profile) => profile.id === agreement.presenting_agent_id
  );

  const listingRow = listing as ListingRow | null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agreement summary</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Commission agreement
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <AgreementSummaryClient />
          <Link
            href="/dashboard/collaborations"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
          >
            Back to collaborations
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 text-sm text-slate-700">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Listing</span>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {listingRow?.title || "Listing"}
            </h2>
            <p className="text-sm text-slate-600">
              {listingRow?.city || "Location"} · {listingRow?.currency || "NGN"} {listingRow?.price?.toLocaleString() || "—"}
            </p>
          </div>
          <div className="grid gap-2 text-sm text-slate-600">
            <p>
              Owner agent: <span className="font-semibold text-slate-700">{resolveName(ownerProfile)}</span>
            </p>
            <p>
              Presenting agent: <span className="font-semibold text-slate-700">{resolveName(presentingProfile)}</span>
            </p>
            <p>
              Terms: <span className="font-semibold text-slate-700">{formatCommission(agreement as AgreementRow)}</span>
            </p>
            <p>Status: <span className="capitalize font-semibold text-slate-700">{agreement.status || "proposed"}</span></p>
            {agreement.accepted_at && <p>Accepted: {formatRelativeTime(agreement.accepted_at)}</p>}
            {agreement.declined_at && <p>Declined: {formatRelativeTime(agreement.declined_at)}</p>}
            {agreement.voided_at && <p>Voided: {formatRelativeTime(agreement.voided_at)}</p>}
            {agreement.void_reason && <p>Void reason: {agreement.void_reason}</p>}
          </div>
          {agreement.notes && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              {agreement.notes}
            </div>
          )}
          <p className="text-xs text-slate-400">{LEGAL_COPY}</p>
        </div>
      </div>
    </div>
  );
}
