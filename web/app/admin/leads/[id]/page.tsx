import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { normalizeRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type Params = { id?: string };
type Props = { params: Params | Promise<Params> };

type LeadDetailRow = {
  id: string;
  status: string;
  intent?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  financing_status?: string | null;
  timeline?: string | null;
  message?: string | null;
  created_at?: string | null;
  thread_id?: string | null;
  properties?: { id?: string; title?: string | null; city?: string | null; state_region?: string | null } | null;
  buyer?: { id?: string | null; full_name?: string | null; role?: string | null } | null;
  owner?: { id?: string | null; full_name?: string | null; role?: string | null } | null;
};

export default async function AdminLeadDetailPage({ params }: Props) {
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

  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (!id) redirect("/admin/leads");

  const adminClient = createServiceRoleClient();
  const { data } = await adminClient
    .from("listing_leads")
    .select(
      `id, status, intent, budget_min, budget_max, financing_status, timeline, message, created_at, thread_id,
      properties:properties(id, title, city, state_region, country_code),
      buyer:profiles!listing_leads_buyer_id_fkey(id, full_name, role),
      owner:profiles!listing_leads_owner_id_fkey(id, full_name, role)`
    )
    .eq("id", id)
    .maybeSingle();
  const lead = data as LeadDetailRow | null;

  if (!lead) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-sm text-slate-600">Lead not found.</p>
        <Link href="/admin/leads" className="text-sm font-semibold text-sky-700">
          Back to leads
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Lead</p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {lead.properties?.title || "Listing"}
          </h1>
          <p className="text-sm text-slate-600">
            {lead.properties?.city || ""} {lead.properties?.state_region || ""}
          </p>
        </div>
        <Link href="/admin/leads" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
          Back to leads
        </Link>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Buyer</p>
            <p className="text-sm font-semibold text-slate-900">
              {lead.buyer?.full_name || lead.buyer?.id || "Buyer"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Owner</p>
            <p className="text-sm font-semibold text-slate-900">
              {lead.owner?.full_name || lead.owner?.id || "Owner"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="text-sm font-semibold text-slate-900">{lead.status}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Intent</p>
            <p className="text-sm font-semibold text-slate-900">{lead.intent}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Budget</p>
            <p className="text-sm text-slate-700">
              {lead.budget_min || lead.budget_max
                ? `${lead.budget_min ?? "Any"} – ${lead.budget_max ?? "Any"}`
                : "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Financing</p>
            <p className="text-sm text-slate-700">{lead.financing_status || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Timeline</p>
            <p className="text-sm text-slate-700">{lead.timeline || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Created</p>
            <p className="text-sm text-slate-700">
              {lead.created_at ? new Date(lead.created_at).toLocaleString() : ""}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500">Message</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{lead.message}</p>
        </div>
        {lead.thread_id && (
          <Link
            href={`/dashboard/messages?thread=${lead.thread_id}`}
            className="text-sm font-semibold text-sky-700 hover:underline"
          >
            Open thread
          </Link>
        )}
      </div>
    </div>
  );
}
