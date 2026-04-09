import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import {
  getMoveReadyCategoryLabel,
  getMoveReadyRequestStatusLabel,
} from "@/lib/services/move-ready";
import { getProfile } from "@/lib/auth";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RequestRow = {
  id: string;
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

export default async function HostMoveReadyRequestsPage() {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return (
      <ErrorState
        title="Move & Ready Services unavailable"
        description="Services routing needs the secured database environment before requests can be shown."
        retryHref="/host"
        retryLabel="Back to workspace"
      />
    );
  }

  const profile = await getProfile();
  if (!profile?.id) {
    return (
      <ErrorState
        title="Sign in required"
        description="Sign in again to view property-prep requests."
        retryHref="/auth/login"
        retryLabel="Open login"
      />
    );
  }

  const helpHref = profile.role === "agent" ? "/help/agent/services" : "/help/host/services";

  const client = createServiceRoleClient();
  const { data } = await client
    .from("move_ready_requests")
    .select("id,category,market_code,city,area,status,matched_provider_count,created_at,properties(title)")
    .eq("requester_user_id", profile.id)
    .order("created_at", { ascending: false });

  const requests = (data ?? []) as RequestRow[];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Move &amp; Ready Services
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
                Pilot active
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                Limited capacity
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Property-prep requests</h1>
            <p className="mt-2 text-sm text-slate-600">
              Review matched and unmatched requests for landlord, host, or agent portfolios. This is
              still a manually governed routing flow.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Unmatched requests stay visible for operator follow-up. They are not auto-closed or auto-rerouted.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Link href="/host/services/new">
              <Button>New prep request</Button>
            </Link>
            <Link href={helpHref} className="text-sm font-semibold text-slate-700">
              Read the pilot guide
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {requests.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {getMoveReadyCategoryLabel(item.category)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {[item.area, item.city, item.market_code].filter(Boolean).join(", ")}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.properties?.title?.trim() || "No linked property"} · Created {formatDate(item.created_at)}
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
              <Link href={`/host/services/requests/${item.id}`} className="text-sm font-semibold text-sky-700">
                Open request
              </Link>
            </div>
          </div>
        ))}
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-sm text-slate-500">
            No property-prep requests yet. Start from your workspace when a property needs cleaning,
            fumigation, or minor repairs.
          </div>
        ) : null}
      </section>
    </div>
  );
}
