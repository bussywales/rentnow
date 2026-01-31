import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { normalizeRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type LeadRow = {
  id: string;
  status: string;
  intent?: string | null;
  created_at?: string | null;
  thread_id?: string | null;
  properties?: { id?: string; title?: string | null; city?: string | null; state_region?: string | null } | null;
  buyer?: { id?: string | null; full_name?: string | null } | null;
  owner?: { id?: string | null; full_name?: string | null } | null;
};

function formatLocation(lead: LeadRow) {
  const city = lead.properties?.city ?? "";
  const region = lead.properties?.state_region ?? "";
  return [city, region].filter(Boolean).join(", ");
}

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
      `id, status, intent, created_at, thread_id,
      properties:properties(id, title, city, state_region),
      buyer:profiles!listing_leads_buyer_id_fkey(id, full_name),
      owner:profiles!listing_leads_owner_id_fkey(id, full_name)`
    )
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-600">Read-only view of buy enquiries.</p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
          Back to overview
        </Link>
      </div>
      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {error.message}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          <span>Listing</span>
          <span>Buyer</span>
          <span>Status</span>
          <span>Created</span>
        </div>
        <div className="divide-y divide-slate-100">
          {(data as LeadRow[] | null | undefined)?.map((lead) => (
            <Link
              key={lead.id}
              href={`/admin/leads/${lead.id}`}
              className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              <div>
                <p className="font-semibold text-slate-900">
                  {lead.properties?.title || "Listing"}
                </p>
                <p className="text-xs text-slate-500">{formatLocation(lead)}</p>
              </div>
              <div className="text-xs text-slate-600">
                {lead.buyer?.full_name || lead.buyer?.id || "Buyer"}
              </div>
              <div className="text-xs text-slate-600">{lead.status}</div>
              <div className="text-xs text-slate-500">
                {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : ""}
              </div>
            </Link>
          ))}
          {(!data || (data as LeadRow[]).length === 0) && (
            <div className="px-4 py-6 text-sm text-slate-600">No leads yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
