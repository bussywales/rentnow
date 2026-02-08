import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { normalizeRole } from "@/lib/roles";
import { formatRelativeTime } from "@/lib/date/relative-time";

export const dynamic = "force-dynamic";

export default async function AdminCommissionAgreementsPage() {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    redirect("/forbidden");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/required?redirect=/admin/commission-agreements");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (normalizeRole(profile?.role) !== "admin") redirect("/forbidden?reason=role");

  const adminClient = createServiceRoleClient();
  const { data: agreements } = await adminClient
    .from("agent_commission_agreements")
    .select(
      "id, listing_id, owner_agent_id, presenting_agent_id, commission_type, commission_value, currency, status, notes, created_at, accepted_at"
    )
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
  };

  const agreementRows = (agreements as AgreementRow[] | null) ?? [];
  const listingIds = Array.from(new Set(agreementRows.map((row) => row.listing_id)));
  const profileIds = Array.from(
    new Set(agreementRows.flatMap((row) => [row.owner_agent_id, row.presenting_agent_id]))
  );

  const { data: listings } = listingIds.length
    ? await adminClient
        .from("properties")
        .select("id, title, city, price, currency")
        .in("id", listingIds)
    : { data: [] };

  const { data: profiles } = profileIds.length
    ? await adminClient
        .from("profiles")
        .select("id, full_name, display_name, business_name")
        .in("id", profileIds)
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

  const listingMap = new Map(((listings as ListingRow[] | null) ?? []).map((row) => [row.id, row]));
  const profileMap = new Map(((profiles as ProfileRow[] | null) ?? []).map((row) => [row.id, row]));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Commission agreements</h1>
          <p className="mt-2 text-sm text-slate-600">
            Read-only log of proposed and accepted commission terms.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
          Back to overview
        </Link>
      </div>

      {agreementRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No commission agreements yet.
        </div>
      ) : (
        <div className="space-y-3">
          {agreementRows.map((agreement) => {
            const listing = listingMap.get(agreement.listing_id);
            const owner = profileMap.get(agreement.owner_agent_id);
            const presenting = profileMap.get(agreement.presenting_agent_id);
            return (
              <div key={agreement.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Listing</p>
                    <h2 className="mt-1 text-sm font-semibold text-slate-900">
                      {listing?.title || "Shared listing"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {listing?.city || "Location"} · {agreement.status || "proposed"}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      Owner: {owner?.display_name || owner?.full_name || owner?.business_name || owner?.id}
                    </p>
                    <p className="text-xs text-slate-600">
                      Presented by: {presenting?.display_name || presenting?.full_name || presenting?.business_name || presenting?.id}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p className="font-semibold text-slate-600">{agreement.commission_type || "none"}</p>
                    {agreement.created_at && <p>{formatRelativeTime(agreement.created_at)}</p>}
                  </div>
                </div>
                {agreement.notes && (
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    {agreement.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
