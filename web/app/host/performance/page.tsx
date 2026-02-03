import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/authz";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { fetchOwnerListings } from "@/lib/properties/owner-listings";
import { isListingExpired } from "@/lib/properties/expiry";
import { isPausedStatus, mapStatusLabel, normalizePropertyStatus } from "@/lib/properties/status";
import {
  buildSummaryByProperty,
  fetchPropertyEvents,
  filterRowsSince,
  groupEventsByProperty,
  isUuid,
} from "@/lib/analytics/property-events.server";
import { estimateMissedDemand } from "@/lib/analytics/property-events";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

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

function formatMissedDemand(estimate: ReturnType<typeof estimateMissedDemand>) {
  if (estimate.state === "no_history") return "No live history yet";
  if (estimate.state === "not_enough_data") return "Not enough data yet";
  if (estimate.state === "ok") return `Est. ${estimate.missed}`;
  return "—";
}

export default async function HostPerformancePage() {
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

  let ownerId = user.id;
  if (role === "agent") {
    const actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== user.id) {
      const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
      if (allowed) ownerId = actingAs;
    }
  }

  const { data: properties, error } = await fetchOwnerListings({
    supabase,
    ownerId,
    isAdmin: false,
  });

  if (error) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Performance</h1>
        <p className="text-sm text-slate-600">We couldn't load performance data right now.</p>
      </div>
    );
  }

  const listings = properties ?? [];
  const propertyIds = listings.map((listing) => listing.id).filter(isUuid);
  const last7Start = new Date(Date.now() - 7 * DAY_MS).toISOString();

  let summaryMap = new Map();
  let eventsByProperty = new Map();

  if (propertyIds.length) {
    const { rows } = await fetchPropertyEvents({ propertyIds, sinceDays: 60 });
    eventsByProperty = groupEventsByProperty(rows);
    const last7Rows = filterRowsSince(rows, last7Start);
    summaryMap = buildSummaryByProperty(last7Rows);
  }

  if (!listings.length) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Performance</h1>
        <div
          className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-600"
          data-testid="host-performance-empty"
        >
          No listings yet. Publish a listing to start tracking demand.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Performance</h1>
        <p className="text-sm text-slate-600">
          Demand signals for your listings over the last 7 days.
        </p>
      </div>

      <section
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        data-testid="host-performance-table"
      >
        <div className="grid grid-cols-[2.2fr_1fr_0.8fr_0.8fr_0.9fr_1.4fr_1fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span>Listing</span>
          <span>Status</span>
          <span>Views</span>
          <span>Saves</span>
          <span>Leads</span>
          <span>Featured 7d</span>
          <span>Missed demand</span>
        </div>
        <div className="divide-y divide-slate-100">
          {listings.map((listing) => {
            const status = isListingExpired(listing) ? "expired" : listing.status;
            const normalizedStatus = normalizePropertyStatus(status) ?? status;
            const summary = summaryMap.get(listing.id);
            const views = summary?.views ?? 0;
            const saves = Math.max(summary?.netSaves ?? 0, 0);
            const leads =
              (listing.listing_intent ?? "rent") === "buy"
                ? summary?.enquiries ?? 0
                : summary?.viewingRequests ?? 0;
            const impressions = summary?.featuredImpressions ?? 0;
            const clicks = summary?.featuredClicks ?? 0;
            const featuredLeads = summary?.featuredLeads ?? 0;
            const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : null;
            const missedDemand = estimateMissedDemand({
              listing,
              events: eventsByProperty.get(listing.id) ?? [],
            });
            const showMissed = isPausedStatus(normalizedStatus) || normalizedStatus === "expired";

            return (
              <div
                key={listing.id}
                data-testid={`host-performance-row-${listing.id}`}
                className="grid grid-cols-[2.2fr_1fr_0.8fr_0.8fr_0.9fr_1.4fr_1fr] items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/properties/${listing.id}`}
                    className="block truncate font-semibold text-slate-900"
                  >
                    {listing.title || "Untitled listing"}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {listing.city || "Unknown city"}
                  </div>
                </div>
                <div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusChipClass(
                      normalizedStatus
                    )}`}
                  >
                    {mapStatusLabel(status)}
                  </span>
                </div>
                <div className="text-slate-700 tabular-nums" data-testid={`host-performance-views-${listing.id}`}>
                  {views}
                </div>
                <div className="text-slate-700 tabular-nums" data-testid={`host-performance-saves-${listing.id}`}>
                  {saves}
                </div>
                <div className="text-slate-700 tabular-nums" data-testid={`host-performance-leads-${listing.id}`}>
                  {leads}
                </div>
                <div className="text-xs text-slate-600" data-testid={`host-performance-featured-${listing.id}`}>
                  {impressions > 0 || clicks > 0 || featuredLeads > 0 ? (
                    <div className="space-y-1">
                      <div>Impr. {impressions} · Clicks {clicks}</div>
                      <div>CTR {ctr ? `${ctr}%` : "—"} · Leads {featuredLeads}</div>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
                <div className="text-xs text-slate-600" data-testid={`host-performance-missed-${listing.id}`}>
                  {showMissed ? formatMissedDemand(missedDemand) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
