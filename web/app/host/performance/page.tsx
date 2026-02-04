import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/authz";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { mapStatusLabel, normalizePropertyStatus } from "@/lib/properties/status";
import {
  fetchHostPerformanceRows,
  resolveHostPerformanceRange,
  HOST_PERFORMANCE_RANGES,
} from "@/lib/analytics/host-performance.server";

export const dynamic = "force-dynamic";

function statusChipClass(value: string | null) {
  const normalized = normalizePropertyStatus(value);
  switch (normalized) {
    case "live":
      return "bg-emerald-100 text-emerald-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "draft":
      return "bg-slate-100 text-slate-600";
    case "rejected":
      return "bg-rose-100 text-rose-700";
    case "expired":
      return "bg-amber-100 text-amber-700";
    case "paused":
    case "paused_owner":
    case "paused_occupied":
      return "bg-slate-200 text-slate-700";
    case "changes_requested":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default async function HostPerformancePage({
  searchParams,
}: {
  searchParams?: { range?: string };
}) {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Performance</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured, so performance analytics are unavailable right now.
        </p>
      </div>
    );
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/login?reason=auth");
  }

  const role = await getUserRole(supabase, user.id);
  if (!role) {
    redirect("/onboarding");
  }

  if (role === "tenant") {
    redirect("/tenant/home");
  }

  if (role === "admin") {
    redirect("/admin/support");
  }

  const rangeDays = resolveHostPerformanceRange(searchParams?.range ?? null);
  let ownerId = user.id;
  if (role === "agent") {
    const actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== user.id) {
      const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
      if (allowed) ownerId = actingAs;
    }
  }

  const { rows, error } = await fetchHostPerformanceRows({
    supabase,
    ownerId,
    rangeDays,
  });

  if (error) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Performance</h1>
        <p className="text-sm text-slate-600">We couldn&apos;t load performance data right now.</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Performance</h1>
        <div
          className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-600"
          data-testid="host-performance-empty"
        >
          No listings yet. Publish a listing to start tracking demand.
        </div>
        <div className="text-center">
          <Link href="/dashboard/properties/new" className="text-sm font-semibold text-sky-700">
            Create a listing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Performance</h1>
          <p className="text-sm text-slate-600">
            Demand signals for your listings over the last {rangeDays} days.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {HOST_PERFORMANCE_RANGES.map((range) => {
            const active = range === rangeDays;
            const href = range === 30 ? "/host/performance" : `/host/performance?range=${range}`;
            return (
              <Link
                key={range}
                href={href}
                data-testid={`host-performance-range-${range}`}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {range} days
              </Link>
            );
          })}
        </div>
      </div>

      <section
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        data-testid="host-performance-table"
      >
        <div className="grid grid-cols-[2.2fr_0.9fr_0.8fr_0.8fr_0.9fr_0.9fr_0.9fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span>Listing</span>
          <span>Status</span>
          <span>Views</span>
          <span>Saves</span>
          <span>Enquiries</span>
          <span>Days live</span>
          <span>Lead rate</span>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((row) => {
            const normalizedStatus = normalizePropertyStatus(row.status) ?? row.status ?? null;
            const leadRate = row.leadRate > 0 ? `${(row.leadRate * 100).toFixed(1)}%` : "—";
            return (
              <div
                key={row.id}
                data-testid={`host-performance-row-${row.id}`}
                className="grid grid-cols-[2.2fr_0.9fr_0.8fr_0.8fr_0.9fr_0.9fr_0.9fr] items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/properties/${row.id}`}
                    className="block truncate font-semibold text-slate-900"
                  >
                    {row.title}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {row.city}
                  </div>
                </div>
                <div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusChipClass(
                      normalizedStatus
                    )}`}
                  >
                    {mapStatusLabel(row.status)}
                  </span>
                </div>
                <div className="text-slate-700 tabular-nums" data-testid={`host-performance-views-${row.id}`}>
                  {row.views}
                </div>
                <div className="text-slate-700 tabular-nums" data-testid={`host-performance-saves-${row.id}`}>
                  {row.saves}
                </div>
                <div className="text-slate-700 tabular-nums" data-testid={`host-performance-leads-${row.id}`}>
                  {row.enquiries}
                </div>
                <div className="text-slate-700 tabular-nums" data-testid={`host-performance-days-${row.id}`}>
                  {row.daysLive}
                </div>
                <div className="text-slate-600 tabular-nums" data-testid={`host-performance-rate-${row.id}`}>
                  {leadRate}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
