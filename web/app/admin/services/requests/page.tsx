import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  getMoveReadyCategoryLabel,
  getMoveReadyRequestStatusLabel,
} from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

type RequestRow = {
  id: string;
  requester_role: string;
  category: string;
  market_code: string;
  city: string | null;
  area: string | null;
  status: string;
  matched_provider_count: number;
  created_at: string;
  properties?: { title: string | null } | null;
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function AdminMoveReadyRequestsPage() {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return <div className="p-6 text-sm text-slate-600">Services admin is unavailable.</div>;
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/services/requests&reason=auth");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");

  const client = createServiceRoleClient();
  const { data } = await client
    .from("move_ready_requests")
    .select("id,requester_role,category,market_code,city,area,status,matched_provider_count,created_at,properties(title)")
    .order("created_at", { ascending: false });

  const requests = (data ?? []) as RequestRow[];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Move &amp; Ready requests</h1>
        <p className="text-sm text-slate-600">
          Watch matched versus unmatched requests and intervene only where the routing actually stalled.
        </p>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          {requests.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {getMoveReadyCategoryLabel(item.category)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {[item.area, item.city, item.market_code].filter(Boolean).join(", ")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.requester_role} · {item.properties?.title?.trim() || "No linked property"} · {formatDate(item.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    {getMoveReadyRequestStatusLabel(item.status)}
                  </span>
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-800">
                    Routed {item.matched_provider_count}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <Link href={`/admin/services/requests/${item.id}`} className="text-sm font-semibold text-sky-700">
                  Open request
                </Link>
              </div>
            </div>
          ))}
          {requests.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No property-prep requests have been submitted yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
