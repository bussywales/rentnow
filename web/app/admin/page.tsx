import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UpgradeRequestsQueue } from "@/components/admin/UpgradeRequestsQueue";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { formatRoleLabel } from "@/lib/roles";
import { getAdminListingStats, type ListingStats } from "@/lib/admin/admin-listings";
import { ADMIN_REVIEW_VIEW_TABLE } from "@/lib/admin/admin-review-contracts";
import { isFixRequestRow, isReviewableRow, normalizeStatus } from "@/lib/admin/admin-review-queue";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  draft: "Draft",
  live: "Live",
  rejected: "Rejected",
  paused: "Paused",
  paused_owner: "Paused - Owner hold",
  paused_occupied: "Paused - Occupied",
  changes_requested: "Changes requested",
  expired: "Expired",
};

type RawReviewRow = {
  id: string;
  title?: string | null;
  city?: string | null;
  state_region?: string | null;
  country_code?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  is_approved?: boolean | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  is_active?: boolean | null;
};

type AdminUser = {
  id: string;
  role: string;
  full_name: string | null;
};

type UpgradeRequest = {
  id: string;
  profile_id: string;
  requester_id: string;
  requested_plan_tier: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type ReviewCounts = {
  pending: number;
  changes: number;
  reviewable: number;
  error: string | null;
};

type OverviewData = {
  stats: ListingStats<RawReviewRow>;
  reviewCounts: ReviewCounts;
  users: AdminUser[];
  requests: UpgradeRequest[];
  draftUpdates: number;
  requestId: string | null;
  serviceRoleAvailable: boolean;
  supabaseReady: boolean;
};

async function getReviewCounts(client: SupabaseClient): Promise<ReviewCounts> {
  try {
    const reviewableResult = await client
      .from(ADMIN_REVIEW_VIEW_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("is_approved", false)
      .is("approved_at", null)
      .is("rejected_at", null)
      .or("status.eq.pending,submitted_at.not.is.null");

    const changesResult = await client
      .from(ADMIN_REVIEW_VIEW_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .not("submitted_at", "is", null)
      .not("rejection_reason", "is", null)
      .eq("is_approved", false)
      .is("approved_at", null)
      .is("rejected_at", null);

    const reviewableCount = reviewableResult.count ?? 0;
    const changesCount = changesResult.count ?? 0;
    const pendingCount = Math.max(0, reviewableCount - changesCount);

    return {
      pending: pendingCount,
      changes: changesCount,
      reviewable: reviewableCount,
      error: reviewableResult.error?.message || changesResult.error?.message || null,
    };
  } catch (err) {
    return {
      pending: 0,
      changes: 0,
      reviewable: 0,
      error: (err as Error)?.message ?? "review count fetch failed",
    };
  }
}

async function getOverviewData(): Promise<OverviewData> {
  const supabaseReady = hasServerSupabaseEnv();
  const requestHeaders = await headers();
  const requestId =
    requestHeaders.get("x-vercel-id") ?? requestHeaders.get("x-request-id") ?? null;

  if (!supabaseReady) {
    return {
      stats: { total: 0, statusCounts: {}, activeCounts: { active: 0, inactive: 0 }, recent: [], error: null },
      reviewCounts: { pending: 0, changes: 0, reviewable: 0, error: "Supabase env missing" },
      users: [],
      requests: [],
      draftUpdates: 0,
      requestId,
      serviceRoleAvailable: false,
      supabaseReady,
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin&reason=auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const serviceRoleAvailable = hasServiceRoleEnv();
  const serviceClient = serviceRoleAvailable ? createServiceRoleClient() : null;
  const clientForStats = serviceClient ?? supabase;

  const [usersResult, requestsResult, stats, reviewCounts, draftUpdates] = await Promise.all([
    supabase.from("profiles").select("id, role, full_name"),
    supabase
      .from("plan_upgrade_requests")
      .select("id, profile_id, requester_id, requested_plan_tier, status, notes, created_at")
      .order("created_at", { ascending: false }),
    getAdminListingStats<RawReviewRow>({ client: clientForStats }),
    getReviewCounts(clientForStats),
    clientForStats
      .from("product_updates")
      .select("id", { count: "exact", head: true })
      .is("published_at", null),
  ]);

  return {
    stats,
    reviewCounts,
    users: (usersResult.data as AdminUser[]) || [],
    requests: (requestsResult.data as UpgradeRequest[]) || [],
    draftUpdates: draftUpdates?.count ?? 0,
    requestId,
    serviceRoleAvailable,
    supabaseReady,
  };
}

function formatStatusLabel(status: string | null | undefined) {
  if (!status) return "Unknown";
  const normalized = normalizeStatus(status) ?? status;
  return STATUS_LABELS[normalized] ?? normalized.toUpperCase();
}

export default async function AdminOverviewPage() {
  const {
    stats,
    reviewCounts,
    users,
    requests,
    draftUpdates,
    requestId,
    serviceRoleAvailable,
    supabaseReady,
  } = await getOverviewData();

  const recentListings = (stats.recent ?? []) as RawReviewRow[];
  const pendingCount = reviewCounts.pending;
  const changesCount = reviewCounts.changes;
  const reviewableCount = reviewCounts.reviewable;
  const upgradePendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      {draftUpdates > 0 && (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="admin-updates-draft-banner"
        >
          <span className="font-semibold">Unpublished updates:</span> {draftUpdates} draft
          {draftUpdates === 1 ? "" : "s"} waiting to be reviewed.{" "}
          <Link href="/admin/product-updates" className="font-semibold underline">
            Review drafts
          </Link>
        </div>
      )}
      <div className="rounded-2xl bg-slate-900/95 px-6 py-5 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-2xl font-semibold">Control panel</p>
        <p className="text-sm text-slate-200">
          Monitor listings and review activity. Restricted to role = admin.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/admin/review"
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Review queue
            {reviewableCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">
                {reviewableCount}
              </span>
            )}
          </Link>
          <Link
            href="/admin/insights"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Insights
          </Link>
          <Link
            href="/admin/listings"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Listings registry
          </Link>
          <Link
            href="/admin/leads"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Leads
          </Link>
          <Link
            href="/admin/users"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            User management
          </Link>
          <Link
            href="/admin/billing"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Billing events
          </Link>
          <Link
            href="/admin/referrals/simulator"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Referral simulator
          </Link>
          <Link
            href="/admin/referrals/payouts"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Referral payouts
          </Link>
          <Link
            href="/admin/referrals/attribution"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Referral attribution
          </Link>
          <Link
            href="/admin/featured/requests"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Featured requests
          </Link>
          <Link
            href="/admin/settings/referrals"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Referral settings
          </Link>
          <Link href="/admin#upgrade-requests" className="inline-flex items-center gap-2 text-sm underline">
            Upgrade requests
            {upgradePendingCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">
                {upgradePendingCount}
              </span>
            )}
          </Link>
        </div>
        {!supabaseReady && (
          <p className="mt-2 text-sm text-amber-100">
            Connect Supabase to moderate real data. Demo mode shows empty lists.
          </p>
        )}
      </div>

      {(stats.error || reviewCounts.error) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold text-amber-950">Admin data may be incomplete</div>
          <p className="mt-1">
            {stats.error || reviewCounts.error}
          </p>
          {requestId && <p className="mt-1 text-xs text-amber-700">Request ID: {requestId}</p>}
          <Link href="/api/admin/review/diagnostics" className="mt-2 inline-block underline">
            Open diagnostics
          </Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending review</p>
          <p className="text-2xl font-semibold text-slate-900">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Changes requested</p>
          <p className="text-2xl font-semibold text-slate-900">{changesCount}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Live listings</p>
          <p className="text-2xl font-semibold text-slate-900">
            {stats.statusCounts["live"] ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Drafts</p>
          <p className="text-2xl font-semibold text-slate-900">
            {stats.statusCounts["draft"] ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Rejected</p>
          <p className="text-2xl font-semibold text-slate-900">
            {stats.statusCounts["rejected"] ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active</p>
          <p className="text-2xl font-semibold text-slate-900">
            {stats.activeCounts.active}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Inactive</p>
          <p className="text-2xl font-semibold text-slate-900">
            {stats.activeCounts.inactive}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Attention needed</h2>
            <p className="text-sm text-slate-600">Quick signals to keep reviews moving.</p>
          </div>
          <Link href="/admin/review" className="text-sm text-sky-700">
            Open review queue
          </Link>
        </div>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>
            {pendingCount > 0
              ? `${pendingCount} listings are waiting for review.`
              : "No listings waiting for review."}
          </li>
          <li>
            {changesCount > 0
              ? `${changesCount} listings are awaiting host fixes.`
              : "No change requests outstanding."}
          </li>
          {!serviceRoleAvailable && (
            <li className="text-amber-700">
              Service role not configured — some counts may be incomplete.
            </li>
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recently updated listings</h2>
            <p className="text-sm text-slate-600">Last 10 updates across the registry.</p>
          </div>
          <Link href="/admin/listings" className="text-sm text-sky-700">
            Go to Listings
          </Link>
        </div>
        <div className="divide-y divide-slate-100 text-sm">
          {recentListings.map((item) => {
            const reviewable =
              isFixRequestRow({
                status: item.status ?? null,
                submitted_at: item.submitted_at ?? null,
                rejection_reason: item.rejection_reason ?? null,
                is_approved: item.is_approved ?? null,
                approved_at: item.approved_at ?? null,
              }) ||
              isReviewableRow({
                status: item.status ?? null,
                submitted_at: item.submitted_at ?? null,
                is_approved: item.is_approved ?? null,
                approved_at: item.approved_at ?? null,
                rejected_at: item.rejected_at ?? null,
              });
            const href = reviewable
              ? `/admin/review?id=${encodeURIComponent(item.id)}`
              : `/admin/listings/${encodeURIComponent(item.id)}`;
            return (
              <Link
                key={item.id}
                href={href}
                className="flex items-center justify-between px-3 py-3 hover:bg-slate-50"
              >
                <div>
                  <div className="font-semibold text-slate-900">{item.title || "Untitled"}</div>
                  <div className="text-xs text-slate-500">
                    {item.city || "Unknown city"} · {formatStatusLabel(item.status ?? null)}
                  </div>
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  {item.updated_at || item.created_at || "—"}
                </div>
              </Link>
            );
          })}
          {!recentListings.length && (
            <p className="text-sm text-slate-600">No recent listings found.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Users</h2>
            <p className="text-sm text-slate-600">Basic list for audits (Supabase auth + profiles).</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 text-sm">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-semibold text-slate-900">{user.full_name || "No name"}</p>
                <p className="text-slate-600">Role: {formatRoleLabel(user.role)}</p>
              </div>
            </div>
          ))}
          {!users.length && <p className="text-sm text-slate-600">No users found.</p>}
        </div>
      </div>

      <UpgradeRequestsQueue initialRequests={requests} users={users} />
    </div>
  );
}
