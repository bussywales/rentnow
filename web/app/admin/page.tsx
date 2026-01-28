import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyBulkActions } from "@/components/admin/PropertyBulkActions";
import { UpgradeRequestsQueue } from "@/components/admin/UpgradeRequestsQueue";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logApprovalAction } from "@/lib/observability";
import { formatRoleLabel } from "@/lib/roles";
import { getAdminReviewQueue, isReviewableRow, normalizeStatus, isFixRequestRow, ALLOWED_PROPERTY_STATUSES } from "@/lib/admin/admin-review-queue";
import { ADMIN_REVIEW_QUEUE_SELECT } from "@/lib/admin/admin-review-contracts";
import { getAdminAllListings, getAdminListingStats, parseAdminListingsQuery } from "@/lib/admin/admin-listings";
import type { AdminListingsQuery, ListingStats } from "@/lib/admin/admin-listings";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import { computeListingReadiness } from "@/lib/properties/listing-readiness";
import type { PropertyImage } from "@/lib/types";
import { computeLocationQuality } from "@/lib/properties/location-quality";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import AdminReviewPanelClient from "@/components/admin/AdminReviewPanelClient";
import AdminListingsPanelClient from "@/components/admin/AdminListingsPanelClient";
import { headers } from "next/headers";
import { normalizeTabParam, sanitizeAdminSearchParams } from "@/lib/admin/admin-tabs";
import { AdminTabNav } from "@/components/admin/AdminTabNav";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

function isRedirectError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

type AdminProperty = {
  id: string;
  title: string;
  city: string;
  rental_type: string;
  is_approved: boolean;
  status?: string | null;
  rejection_reason?: string | null;
  owner_id?: string;
};

type RawReviewRow = AdminProperty & {
  updated_at?: string | null;
  created_at?: string | null;
  state_region?: string | null;
  country_code?: string | null;
  admin_area_1?: string | null;
  admin_area_2?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  is_active?: boolean | null;
  photo_count?: number | null;
  has_video?: boolean | null;
  video_count?: number | null;
  cover_image_url?: string | null;
  price?: number | null;
  currency?: string | null;
  rent_period?: string | null;
  rental_type?: string | null;
  listing_type?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
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

type AdminCounts = {
  pending: number;
  changes: number;
  approved: number;
  all: number;
};

type AdminPageData = {
  reviewListings: AdminReviewListItem[];
  listings: AdminReviewListItem[];
  recentListings: AdminReviewListItem[];
  listingQuery: AdminListingsQuery;
  listingCount: number;
  listingPage: number;
  listingPageSize: number;
  listingTotalCount: number;
  listingContractDegraded: boolean;
  listingError: string | null;
  listingStats: ListingStats<RawReviewRow>;
  counts: AdminCounts;
  users: AdminUser[];
  requests: UpgradeRequest[];
  pendingReviewCount: number;
  serviceRoleAvailable: boolean;
  serviceRoleError: unknown;
  queueSource: string;
  serviceRoleStatus: number | null;
  meta: Record<string, unknown> | null;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...ALLOWED_PROPERTY_STATUSES.map((status) => ({ value: status, label: status.toUpperCase() })),
];

async function getData(
  rawSearchParams: Record<string, string | string[] | undefined>,
  activeTab: "overview" | "review" | "listings"
): Promise<AdminPageData> {
  const searchParams = sanitizeAdminSearchParams(rawSearchParams);
  const listingQuery = parseAdminListingsQuery(searchParams);

  if (!hasServerSupabaseEnv()) {
    return {
      reviewListings: [],
      listings: [],
      recentListings: [],
      listingQuery,
      listingCount: 0,
      listingPage: listingQuery.page,
      listingPageSize: listingQuery.pageSize,
      listingTotalCount: 0,
      listingContractDegraded: false,
      listingError: null,
      listingStats: { total: 0, statusCounts: {}, activeCounts: { active: 0, inactive: 0 }, recent: [], error: null },
      counts: { pending: 0, changes: 0, approved: 0, all: 0 },
      users: [],
      requests: [],
      pendingReviewCount: 0,
      serviceRoleAvailable: false,
      serviceRoleError: null,
      queueSource: "user",
      serviceRoleStatus: null,
      meta: null,
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: viewerProfile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    const viewerRole = viewerProfile?.role ?? null;
    const serviceClient = viewerRole === "admin" && hasServiceRoleEnv() ? createServiceRoleClient() : null;

    const [usersResult, requestsResult] = await Promise.all([
      supabase.from("profiles").select("id, role, full_name"),
      supabase
        .from("plan_upgrade_requests")
        .select("id, profile_id, requester_id, requested_plan_tier, status, notes, created_at")
        .order("created_at", { ascending: false }),
    ]);

    const clientForListings = serviceClient ?? supabase;
    const [queueResult, listingStats] = await Promise.all([
      getAdminReviewQueue({
        userClient: supabase,
        serviceClient,
        viewerRole,
        select: ADMIN_REVIEW_QUEUE_SELECT,
        view: "pending",
      }),
      getAdminListingStats<RawReviewRow>({ client: clientForListings }),
    ]);

    const queueRowsAll = (queueResult.rows ?? queueResult.data ?? []) as RawReviewRow[];
    let listingsResult = {
      rows: [] as RawReviewRow[],
      count: listingStats.total,
      page: listingQuery.page,
      pageSize: listingQuery.pageSize,
      contractDegraded: false,
    };
    let listingError: string | null = null;
    if (activeTab === "listings") {
      try {
        listingsResult = await getAdminAllListings<RawReviewRow>({
          client: clientForListings,
          query: listingQuery,
        });
      } catch (err) {
        listingError = (err as Error)?.message ?? "Failed to load listings";
      }
    }

    const recentRows = (listingStats.recent ?? []) as RawReviewRow[];
    const ownerIds = Array.from(
      new Set(
        [...queueRowsAll, ...listingsResult.rows, ...recentRows]
          .map((p) => p.owner_id)
          .filter(Boolean)
      )
    ) as string[];

    const { data: ownerProfiles } = ownerIds.length
      ? await supabase.from("profiles").select("id, full_name, role").in("id", ownerIds)
      : { data: [] };
    const owners = Object.fromEntries(
      (ownerProfiles || []).map((p) => [p.id, p.full_name || formatRoleLabel(p.role) || "Host"])
    );

    const mapRow = (p: RawReviewRow): AdminReviewListItem => {
      const readiness = computeListingReadiness(
        { ...(p as object), images: [] as PropertyImage[] } as unknown as Parameters<
          typeof computeListingReadiness
        >[0]
      );
      const locationQuality = computeLocationQuality({
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        location_label: p.location_label ?? null,
        location_place_id: p.location_place_id ?? null,
        country_code: p.country_code ?? null,
        admin_area_1: p.admin_area_1 ?? p.state_region ?? null,
        admin_area_2: p.admin_area_2 ?? null,
        postal_code: p.postal_code ?? null,
        city: p.city ?? null,
      });
      return {
        id: p.id,
        title: p.title || "Untitled",
        hostName: owners[p.owner_id || ""] || "Host",
        ownerId: p.owner_id ?? null,
        updatedAt: p.updated_at || p.created_at || null,
        city: p.city ?? null,
        state_region: p.state_region ?? null,
        country_code: p.country_code ?? null,
        readiness,
        locationQuality: locationQuality.quality,
        photoCount: typeof p.photo_count === "number" ? p.photo_count : 0,
        hasVideo: !!p.has_video || (p.video_count ?? 0) > 0,
        status: normalizeStatus(p.status ?? null),
        submitted_at: p.submitted_at ?? null,
        is_approved: p.is_approved ?? null,
        approved_at: p.approved_at ?? null,
        rejected_at: p.rejected_at ?? null,
        is_active: p.is_active ?? null,
        rejectionReason: p.rejection_reason ?? null,
        price: p.price ?? null,
        currency: p.currency ?? null,
        rent_period: p.rent_period ?? null,
        rental_type: p.rental_type ?? null,
        listing_type: p.listing_type ?? null,
        bedrooms: p.bedrooms ?? null,
        bathrooms: p.bathrooms ?? null,
        reviewable: isReviewableRow({
          status: p.status ?? null,
          submitted_at: p.submitted_at ?? null,
          is_approved: p.is_approved ?? null,
          approved_at: p.approved_at ?? null,
          rejected_at: p.rejected_at ?? null,
        }),
      };
    };

    const reviewListingsAll = queueRowsAll.map(mapRow);
    const reviewListings = reviewListingsAll.filter(
      (item) =>
        isReviewableRow({
          status: item.status ?? null,
          submitted_at: item.submitted_at ?? null,
          is_approved: item.is_approved ?? null,
          approved_at: item.approved_at ?? null,
          rejected_at: item.rejected_at ?? null,
        }) ||
        isFixRequestRow({
          status: item.status ?? null,
          submitted_at: item.submitted_at ?? null,
          rejection_reason: item.rejectionReason ?? null,
          is_approved: item.is_approved ?? null,
          approved_at: item.approved_at ?? null,
        })
    );

    const listings = listingsResult.rows.map(mapRow);
    const recentListings = recentRows.map(mapRow);

    const changesCount = reviewListingsAll.filter((item) =>
      isFixRequestRow({
        status: item.status ?? null,
        submitted_at: item.submitted_at ?? null,
        rejection_reason: item.rejectionReason ?? null,
        is_approved: item.is_approved ?? null,
        approved_at: item.approved_at ?? null,
      })
    ).length;

    const pendingCount = reviewListingsAll.length - changesCount;

    return {
      reviewListings,
      listings,
      recentListings,
      listingQuery,
      listingCount: listingsResult.count,
      listingPage: listingsResult.page,
      listingPageSize: listingsResult.pageSize,
      listingTotalCount: listingStats.total,
      listingContractDegraded: listingsResult.contractDegraded,
      listingError,
      listingStats,
      users: (usersResult.data as AdminUser[]) || [],
      requests: (requestsResult.data as UpgradeRequest[]) || [],
      pendingReviewCount: queueResult.count ?? reviewListings.length,
      counts: {
        pending: pendingCount,
        changes: changesCount,
        approved: listingStats.statusCounts["live"] ?? 0,
        all: listingStats.total,
      },
      serviceRoleAvailable: queueResult.serviceRoleAvailable,
      serviceRoleError: queueResult.serviceRoleError,
      queueSource: queueResult.meta.source,
      serviceRoleStatus: queueResult.meta.serviceStatus ?? queueResult.serviceRoleStatus,
      meta: {
        ...queueResult.meta,
        contractDegraded:
          (queueResult.meta as { contractDegraded?: boolean })?.contractDegraded ||
          listingsResult.contractDegraded,
      },
    };
  } catch (err) {
    console.warn("Admin data load failed; rendering empty state", err);
    return {
      reviewListings: [],
      listings: [],
      recentListings: [],
      listingQuery,
      listingCount: 0,
      listingPage: listingQuery.page,
      listingPageSize: listingQuery.pageSize,
      listingTotalCount: 0,
      listingContractDegraded: false,
      listingError: (err as Error)?.message ?? null,
      listingStats: { total: 0, statusCounts: {}, activeCounts: { active: 0, inactive: 0 }, recent: [], error: (err as Error)?.message ?? null },
      users: [],
      requests: [],
      pendingReviewCount: 0,
      counts: { pending: 0, changes: 0, approved: 0, all: 0 },
      serviceRoleAvailable: false,
      serviceRoleError: err,
      queueSource: "user",
      serviceRoleStatus: null,
      meta: { source: "user", serviceAttempted: false, serviceOk: false, serviceStatus: null, serviceError: "fetch failed" },
    };
  }
}

async function bulkUpdate(formData: FormData) {
  "use server";
  if (!hasServerSupabaseEnv()) return;
  const { supabase, user } = await getServerAuthUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return;

  const ids = formData.getAll("ids").map((value) => String(value)).filter(Boolean);
  if (!ids.length) return;

  const actionValue = formData.get("action");
  const action = actionValue === "approve" || actionValue === "reject" ? actionValue : null;
  if (!action) return;

  const reasonValue = formData.get("reason");
  const reason = typeof reasonValue === "string" ? reasonValue.trim() : "";
  if (action === "reject" && !reason) return;

  const now = new Date().toISOString();
  const update =
    action === "approve"
      ? {
          status: "live",
          is_approved: true,
          is_active: true,
          approved_at: now,
          rejection_reason: null,
          rejected_at: null,
        }
      : {
          status: "rejected",
          is_approved: false,
          is_active: false,
          rejected_at: now,
          rejection_reason: reason,
        };

  const { error } = await supabase.from("properties").update(update).in("id", ids);
  if (error) return;

  ids.forEach((propertyId) => {
    logApprovalAction({
      route: "/admin",
      actorId: user.id,
      propertyId,
      action,
      reasonProvided: action === "reject",
    });
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export default async function AdminPage({ searchParams }: Props) {
  const cleanedSearchParams = sanitizeAdminSearchParams(searchParams);
  console.log("[/admin] render start", {
    tab: cleanedSearchParams.tab,
  });
  const supabaseReady = hasServerSupabaseEnv();
  const requestHeaders = await headers();
  const requestId =
    requestHeaders.get("x-vercel-id") ?? requestHeaders.get("x-request-id") ?? null;

  if (supabaseReady) {
    try {
      const { supabase, user } = await getServerAuthUser();

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
    } catch (err) {
      if (isRedirectError(err)) {
        throw err;
      }
      console.warn("Admin auth guard failed; showing demo state", err);
    }
  }
  console.log("[/admin] after auth check");

  const activeTab = normalizeTabParam(cleanedSearchParams.tab);

  const buildListingsPageHref = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(cleanedSearchParams).forEach(([key, value]) => {
      if (key === "page") return;
      if (Array.isArray(value)) {
        if (value[0]) params.set(key, value[0]);
      } else if (value) {
        params.set(key, value);
      }
    });
    params.set("tab", "listings");
    params.set("page", String(page));
    params.set("pageSize", String(listingPageSize));
    const qs = params.toString();
    return qs ? `/admin?${qs}` : "/admin?tab=listings";
  };

  const {
    reviewListings,
    listings,
    recentListings,
    listingQuery,
    listingCount,
    listingPage,
    listingPageSize,
    listingTotalCount,
    listingContractDegraded,
    listingError,
    listingStats,
    counts,
    users,
    requests,
    pendingReviewCount,
    serviceRoleAvailable,
    serviceRoleError,
    queueSource,
    serviceRoleStatus,
    meta,
  } = await getData(cleanedSearchParams, activeTab);
  console.log("[/admin] before review panel", {
    count: reviewListings.length,
    serviceOk: meta?.serviceOk,
    source: meta?.source,
  });
  const upgradePendingCount = requests.filter((request) => request.status === "pending").length;
  const serviceAttempted = meta?.serviceAttempted === true;
  const serviceOk = meta?.serviceOk === true;
  const serviceFailure = serviceAttempted && !serviceOk;
  const contractDegraded = (meta as { contractDegraded?: boolean })?.contractDegraded;
  console.log("[/admin] after review panel props", {
    count: reviewListings.length,
    serviceFailure,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Control panel</p>
        <p className="text-sm text-slate-200">
          Approve listings and audit users. Restricted to role = admin.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link
            href="/admin/users"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Open user management
          </Link>
          <Link
            href="/admin/billing"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Billing events
          </Link>
          <Link href="/admin#upgrade-requests" className="inline-flex items-center gap-2 text-sm underline">
            Upgrade requests
            {upgradePendingCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">
                {upgradePendingCount}
              </span>
            )}
          </Link>
          <Link
            href="/admin/review"
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Review desk
            {pendingReviewCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">
                {pendingReviewCount}
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

      <AdminTabNav
        serverSearchParams={searchParams}
        countsPending={counts.pending}
        listingsCount={listingTotalCount}
      />

      {activeTab === "overview" && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
                <p className="text-sm text-slate-600">Operational snapshot of listings and review activity.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link href="/admin?tab=review" className="rounded border border-slate-300 px-3 py-1">
                  Go to Review queue
                </Link>
                <Link href="/admin?tab=listings" className="rounded border border-slate-300 px-3 py-1">
                  Go to Listings
                </Link>
              </div>
            </div>
            {(serviceFailure || listingStats.error || serviceRoleError || listingError) && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-semibold text-amber-950">Admin data may be incomplete</div>
                <p className="mt-1">
                  {listingError || "Service fetch reported an issue. Check diagnostics if counts look incorrect."}
                </p>
                <Link href="/api/admin/review/diagnostics" className="underline">
                  Open diagnostics
                </Link>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Pending review</p>
                <p className="text-2xl font-semibold text-slate-900">{counts.pending}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Changes requested</p>
                <p className="text-2xl font-semibold text-slate-900">{counts.changes}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Live</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {listingStats.statusCounts["live"] ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Draft</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {listingStats.statusCounts["draft"] ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Rejected</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {listingStats.statusCounts["rejected"] ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Paused</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {listingStats.statusCounts["paused"] ?? 0}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Active</p>
                <p className="text-2xl font-semibold text-slate-900">{listingStats.activeCounts.active}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Inactive</p>
                <p className="text-2xl font-semibold text-slate-900">{listingStats.activeCounts.inactive}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Recently updated listings</h3>
            <div className="mt-3 space-y-2 text-sm">
              {recentListings.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin?tab=listings&id=${encodeURIComponent(item.id)}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-500">
                      {item.city || "Unknown city"} · {item.status || "unknown"}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{item.updatedAt ?? "—"}</div>
                </Link>
              ))}
              {!recentListings.length && (
                <p className="text-sm text-slate-600">No recent listings found.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Users</h2>
                <p className="text-sm text-slate-600">
                  Basic list for audits (Supabase auth + profiles).
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {user.full_name || "No name"}
                    </p>
                    <p className="text-slate-600">Role: {formatRoleLabel(user.role)}</p>
                  </div>
                </div>
              ))}
              {!users.length && (
                <p className="text-sm text-slate-600">No users found.</p>
              )}
            </div>
            {!serviceRoleAvailable && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {ADMIN_REVIEW_COPY.warnings.missingServiceRole}
              </div>
            )}
            {Boolean(serviceRoleError) && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {ADMIN_REVIEW_COPY.warnings.serviceFetchFailed}
              </div>
            )}
            {queueSource === "user" && serviceFailure && (
              <p className="mt-1 text-xs text-amber-200">
                Service fetch status: {String(meta?.serviceStatus ?? serviceRoleStatus ?? "unknown")}. See diagnostics.
              </p>
            )}
          </div>

          <UpgradeRequestsQueue initialRequests={requests} users={users} />
        </>
      )}

      {activeTab === "review" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Review queue</h2>
              <p className="text-sm text-slate-600">
                Approve or reject listings before they go live. Click a row to open the review drawer.
              </p>
              <p className="text-xs text-slate-500">
                Pending ({counts.pending}) · changes requested ({counts.changes})
              </p>
            </div>
            <Link href="/dashboard/properties/new" className="text-sm text-sky-700">
              Create listing
            </Link>
          </div>
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <PropertyBulkActions action={bulkUpdate} />
          </div>
          {contractDegraded && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-semibold text-amber-950">Database view is out of date</div>
              <p className="mt-1">
                admin_review_view missing expected columns (pricing). Apply migration 20260127132459_admin_review_view.sql.
              </p>
              <Link href="/api/admin/review/diagnostics" className="underline">
                Open diagnostics
              </Link>
            </div>
          )}
          {serviceFailure && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-semibold text-amber-950">Review queue unavailable</div>
              <p className="mt-1">
                Service fetch failed (status {String(meta?.serviceStatus ?? serviceRoleStatus ?? "unknown")}). The page is still usable without crashing.
              </p>
              {requestId && <p className="mt-1 text-xs text-amber-700">Request ID: {requestId}</p>}
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <Link href="/api/admin/review/diagnostics" className="rounded border border-amber-300 px-3 py-1 underline">
                  Open diagnostics
                </Link>
                <Link href="/admin/review" className="rounded border border-amber-300 px-3 py-1 underline">
                  Open review desk
                </Link>
                <Link href="/admin" className="rounded border border-amber-300 px-3 py-1 underline">
                  Reload
                </Link>
              </div>
            </div>
          )}
          <AdminReviewPanelClient
            listings={reviewListings}
            initialSelectedId={
              cleanedSearchParams.id
                ? Array.isArray(cleanedSearchParams.id)
                  ? cleanedSearchParams.id[0]
                  : cleanedSearchParams.id
                : null
            }
          />
        </div>
      )}

      {activeTab === "listings" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All listings</h2>
              <p className="text-sm text-slate-600">
                Search and filter across every listing. Uses the same admin_review_view contract (no phantom fields).
              </p>
            </div>
            <Link href="/dashboard/properties/new" className="text-sm text-sky-700">
              Create listing
            </Link>
          </div>
          {(serviceFailure || contractDegraded || listingContractDegraded || serviceRoleError || listingError) && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-semibold text-amber-950">Listings may be partial</div>
              <p className="mt-1">
                {listingError || "Queue/view fetch reported an issue. Check diagnostics and ensure admin_review_view matches the contract."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href="/api/admin/review/diagnostics" className="underline">
                  Open diagnostics
                </Link>
                <Link href="/admin/review" className="underline">
                  Review desk
                </Link>
              </div>
            </div>
          )}
          <form method="get" className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="tab" value="listings" />
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Search</label>
              <input
                name="q"
                type="text"
                placeholder="Search title or paste ID"
                defaultValue={listingQuery.q ?? ""}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Search mode</label>
              <select name="qMode" defaultValue={listingQuery.qMode} className="rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="title">Title</option>
                <option value="id">Listing ID</option>
                <option value="owner">Owner ID</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Status</label>
              <select name="status" defaultValue={listingQuery.status ?? "all"} className="rounded border border-slate-300 px-2 py-1 text-sm">
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Active</label>
              <select name="active" defaultValue={listingQuery.active} className="rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Sort</label>
              <select name="sort" defaultValue={listingQuery.sort} className="rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="updated_at.desc">Updated (newest)</option>
                <option value="updated_at.asc">Updated (oldest)</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Page size</label>
              <select name="pageSize" defaultValue={listingPageSize} className="rounded border border-slate-300 px-2 py-1 text-sm">
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
                Apply filters
              </button>
            </div>
          </form>
          <div className="mb-3 text-sm text-slate-600">
            Showing {listings.length} of {listingCount} listings.
          </div>
          <AdminListingsPanelClient
            listings={listings}
            initialSelectedId={
              cleanedSearchParams.id
                ? Array.isArray(cleanedSearchParams.id)
                  ? cleanedSearchParams.id[0]
                  : cleanedSearchParams.id
                : null
            }
          />
          {listingCount > listingPageSize && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <Link
                href={buildListingsPageHref(Math.max(1, listingPage - 1))}
                className={`rounded border border-slate-300 px-3 py-1 ${listingPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                Previous
              </Link>
              <span>
                Page {listingPage} of {Math.max(1, Math.ceil(listingCount / listingPageSize))}
              </span>
              <Link
                href={buildListingsPageHref(listingPage + 1)}
                className={`rounded border border-slate-300 px-3 py-1 ${
                  listingPage >= Math.ceil(listingCount / listingPageSize) ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Next
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
