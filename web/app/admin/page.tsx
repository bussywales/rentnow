import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyBulkActions } from "@/components/admin/PropertyBulkActions";
import { UpgradeRequestsQueue } from "@/components/admin/UpgradeRequestsQueue";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logApprovalAction } from "@/lib/observability";
import { formatRoleLabel } from "@/lib/roles";
import { buildStatusOrFilter, getAdminReviewQueue, getStatusesForView, isReviewableRow, normalizeStatus, isStatusInView, isFixRequestRow } from "@/lib/admin/admin-review-queue";
import { ADMIN_REVIEW_QUEUE_SELECT, ADMIN_REVIEW_VIEW_SELECT_MIN, ADMIN_REVIEW_VIEW_TABLE, normalizeSelect } from "@/lib/admin/admin-review-contracts";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import { computeListingReadiness } from "@/lib/properties/listing-readiness";
import type { PropertyImage } from "@/lib/types";
import { computeLocationQuality } from "@/lib/properties/location-quality";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import AdminReviewPanelClient from "@/components/admin/AdminReviewPanelClient";
import { headers } from "next/headers";

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

type ListingFilters = {
  status: string | null;
  priceMin: number | null;
  priceMax: number | null;
  propertyType: string | null;
  bedsMin: number | null;
  bathsMin: number | null;
};

const ALLOWED_VIEWS: Array<"pending" | "changes" | "approved" | "all"> = ["pending", "changes", "approved", "all"];
function normalizeViewServer(value: string | null | undefined): "pending" | "changes" | "approved" | "all" {
  if (!value) return "pending";
  const lower = value.toLowerCase();
  return (ALLOWED_VIEWS.includes(lower as typeof ALLOWED_VIEWS[number]) ? lower : "pending") as
    | "pending"
    | "changes"
    | "approved"
    | "all";
}

function parseNumberParam(value: string | string[] | undefined): number | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function parseStringParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value || null;
}

async function getData(searchParams: Record<string, string | string[] | undefined>) {
  if (!hasServerSupabaseEnv()) {
    return {
      reviewListings: [],
      reviewListingsAll: [],
      listingsFiltered: [],
      listingsAll: [],
      view: "pending",
      counts: { pending: 0, changes: 0, approved: 0, all: 0 },
      filters: {
        status: null,
        priceMin: null,
        priceMax: null,
        propertyType: null,
        bedsMin: null,
        bathsMin: null,
      },
      users: [],
      requests: [],
      pendingReviewCount: 0,
      serviceRoleAvailable: false,
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
    const { data: users } = await supabase
      .from("profiles")
      .select("id, role, full_name");

    const { data: requests } = await supabase
      .from("plan_upgrade_requests")
      .select("id, profile_id, requester_id, requested_plan_tier, status, notes, created_at")
      .order("created_at", { ascending: false });

    const viewParam = parseStringParam(searchParams.view);
    const view = normalizeViewServer(viewParam);

    const filters: ListingFilters = {
      status: parseStringParam(searchParams.status),
      priceMin: parseNumberParam(searchParams.priceMin),
      priceMax: parseNumberParam(searchParams.priceMax),
      propertyType: parseStringParam(searchParams.propertyType),
      bedsMin: parseNumberParam(searchParams.bedsMin),
      bathsMin: parseNumberParam(searchParams.bathsMin),
    };

    const queueResult = await getAdminReviewQueue({
      userClient: supabase,
      serviceClient,
      viewerRole,
      select: ADMIN_REVIEW_QUEUE_SELECT,
      view: "all",
    });
    console.log("[admin] pending status set", {
      view,
      statuses: getStatusesForView(view),
      or: buildStatusOrFilter(view),
      source: queueResult.meta.source,
      status: queueResult.meta.serviceStatus,
    });

    const queueRowsAll = (queueResult.rows ?? queueResult.data ?? []) as RawReviewRow[];
    const ownerIds = Array.from(new Set(queueRowsAll.map((p) => p.owner_id).filter(Boolean))) as string[];
    const { data: ownerProfiles } = ownerIds.length
      ? await supabase.from("profiles").select("id, full_name, role").in("id", ownerIds)
      : { data: [] };
    const owners = Object.fromEntries(
      (ownerProfiles || []).map((p) => [p.id, p.full_name || formatRoleLabel(p.role) || "Host"])
    );

    const mapRow = (p: RawReviewRow): AdminReviewListItem => {
      const readiness = computeListingReadiness({ ...(p as object), images: [] as PropertyImage[] } as unknown as Parameters<typeof computeListingReadiness>[0]);
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
    const reviewListings = reviewListingsAll.filter((item) => {
      if (view === "changes") return isFixRequestRow({ status: item.status, submitted_at: item.submitted_at, rejection_reason: item.rejectionReason, is_approved: item.is_approved, approved_at: item.approved_at });
      if (view === "approved") return isStatusInView(item.status ?? null, "approved");
      if (view === "pending") return isStatusInView(item.status ?? null, "pending") || item.reviewable;
      return true;
    });

    // Fetch all listings (not just reviewable) from the view to power the Listings tab.
    let listingsAllRows: RawReviewRow[] = [];
    let listingsContractDegraded = false;
    const clientForListings = serviceClient ?? supabase;
    const runListingsQuery = async (useMin = false) => {
      const selectString = useMin ? ADMIN_REVIEW_VIEW_SELECT_MIN : ADMIN_REVIEW_QUEUE_SELECT;
      let query = clientForListings
        .from(ADMIN_REVIEW_VIEW_TABLE)
        .select(normalizeSelect(selectString))
        .order("updated_at", { ascending: false })
        .limit(200);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.priceMin !== null) query = query.gte("price", filters.priceMin);
      if (filters.priceMax !== null) query = query.lte("price", filters.priceMax);
      if (filters.propertyType) query = query.eq("listing_type", filters.propertyType);
      if (filters.bedsMin !== null) query = query.gte("bedrooms", filters.bedsMin);
      if (filters.bathsMin !== null) query = query.gte("bathrooms", filters.bathsMin);
      const res = await query;
      if (res.error) throw res.error;
      return Array.isArray(res.data) ? (res.data as unknown as RawReviewRow[]) : [];
    };
    try {
      listingsAllRows = await runListingsQuery(false);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "42703" || /does not exist/i.test((err as { message?: string })?.message ?? "")) {
        listingsContractDegraded = true;
        listingsAllRows = await runListingsQuery(true);
      } else {
        throw err;
      }
    }
    const listingsAll = listingsAllRows.map(mapRow);

    const listingsFiltered = listingsAll.filter((item) => {
      if (filters.status && normalizeStatus(item.status ?? null) !== normalizeStatus(filters.status)) return false;
      if (filters.priceMin !== null && (item.price ?? 0) < filters.priceMin) return false;
      if (filters.priceMax !== null && (item.price ?? 0) > filters.priceMax) return false;
      if (filters.propertyType && item.listing_type !== filters.propertyType) return false;
      if (filters.bedsMin !== null && (item.bedrooms ?? 0) < filters.bedsMin) return false;
      if (filters.bathsMin !== null && (item.bathrooms ?? 0) < filters.bathsMin) return false;
      return true;
    });

    return {
      reviewListings,
      reviewListingsAll,
      listingsAll,
      listingsFiltered,
      view,
      counts: {
        pending: reviewListingsAll.filter((r) => isStatusInView(r.status ?? null, "pending") || r.reviewable).length,
        changes: reviewListingsAll.filter((r) =>
          isFixRequestRow({
            status: r.status,
            submitted_at: r.submitted_at,
            rejection_reason: r.rejectionReason,
            is_approved: r.is_approved,
            approved_at: r.approved_at,
          })
        ).length,
        approved: reviewListingsAll.filter((r) => isStatusInView(r.status ?? null, "approved")).length,
        all: reviewListingsAll.length,
      },
      filters,
      users: (users as AdminUser[]) || [],
      requests: (requests as UpgradeRequest[]) || [],
      pendingReviewCount: queueResult.count ?? (Array.isArray(queueResult.data) ? queueResult.data.length : 0),
      serviceRoleAvailable: queueResult.serviceRoleAvailable,
      serviceRoleError: queueResult.serviceRoleError,
      queueSource: queueResult.meta.source,
      serviceRoleStatus: queueResult.meta.serviceStatus ?? queueResult.serviceRoleStatus,
      meta: {
        ...queueResult.meta,
        contractDegraded:
          (queueResult.meta as { contractDegraded?: boolean })?.contractDegraded || listingsContractDegraded,
      },
    };
  } catch (err) {
    console.warn("Admin data load failed; rendering empty state", err);
    return {
      reviewListings: [],
      reviewListingsAll: [],
      listingsFiltered: [],
      listingsAll: [],
      view: "pending",
      counts: { pending: 0, changes: 0, approved: 0, all: 0 },
      filters: {
        status: null,
        priceMin: null,
        priceMax: null,
        propertyType: null,
        bedsMin: null,
        bathsMin: null,
      },
      users: [],
      requests: [],
      pendingReviewCount: 0,
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
  console.log("[/admin] render start");
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

  const {
    reviewListings,
    listingsFiltered,
    listingsAll,
    view,
    counts,
    filters,
    users,
    requests,
    pendingReviewCount,
    serviceRoleAvailable,
    serviceRoleError,
    queueSource,
    serviceRoleStatus,
    meta,
  } = await getData(searchParams);
  console.log("[/admin] before review panel", {
    count: reviewListings.length,
    serviceOk: meta?.serviceOk,
    source: meta?.source,
  });
  const upgradePendingCount = requests.filter((request) => request.status === "pending").length;
  const serviceFailure = meta?.serviceAttempted && meta?.serviceOk === false;
  const contractDegraded = (meta as { contractDegraded?: boolean })?.contractDegraded;
  console.log("[/admin] after review panel props", {
    count: reviewListings.length,
    serviceFailure,
  });

  const tabParam = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
  const activeTab = tabParam || "overview";

  const buildTabHref = (tabKey: string) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key === "tab") return;
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else if (value) {
        params.set(key, value);
      }
    });
    if (tabKey !== "overview") params.set("tab", tabKey);
    const qs = params.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };

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

      <div className="flex flex-wrap gap-2">
        {[
          { key: "overview", label: "Overview" },
          { key: "review", label: `Review queue (${counts.pending})` },
          { key: "listings", label: `Listings (${listingsAll.length})` },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={buildTabHref(tab.key)}
            className={`rounded-full px-3 py-1 text-sm ${
              activeTab === tab.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
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
            {serviceRoleError && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {ADMIN_REVIEW_COPY.warnings.serviceFetchFailed}
              </div>
            )}
            {queueSource === "user" && meta?.serviceAttempted && meta?.serviceOk === false && (
              <p className="mt-1 text-xs text-amber-200">
                Service fetch status: {meta?.serviceStatus ?? serviceRoleStatus}. See diagnostics.
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
                Current view: {view} · pending ({counts.pending}) · changes requested ({counts.changes}) · approved recent ({counts.approved}) · all ({counts.all})
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
                Service fetch failed (status {meta?.serviceStatus ?? serviceRoleStatus ?? "unknown"}). The page is still usable without crashing.
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
              searchParams.id
                ? Array.isArray(searchParams.id)
                  ? searchParams.id[0]
                  : searchParams.id
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
                Filter by status, price, type, beds, and baths. Uses the same admin_review_view contract (no phantom fields).
              </p>
            </div>
            <Link href="/dashboard/properties/new" className="text-sm text-sky-700">
              Create listing
            </Link>
          </div>
          <form method="get" className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Status</label>
              <select name="status" defaultValue={filters.status ?? ""} className="rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="">Any</option>
                <option value="pending">Pending</option>
                <option value="draft">Draft</option>
                <option value="live">Live</option>
                <option value="rejected">Rejected</option>
                <option value="paused">Paused</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Price min</label>
              <input name="priceMin" type="number" defaultValue={filters.priceMin ?? ""} className="rounded border border-slate-300 px-2 py-1 text-sm" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Price max</label>
              <input name="priceMax" type="number" defaultValue={filters.priceMax ?? ""} className="rounded border border-slate-300 px-2 py-1 text-sm" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Property type</label>
              <input name="propertyType" type="text" placeholder="apartment/house/..." defaultValue={filters.propertyType ?? ""} className="rounded border border-slate-300 px-2 py-1 text-sm" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Beds ≥</label>
              <input name="bedsMin" type="number" defaultValue={filters.bedsMin ?? ""} className="rounded border border-slate-300 px-2 py-1 text-sm" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">Baths ≥</label>
              <input name="bathsMin" type="number" defaultValue={filters.bathsMin ?? ""} className="rounded border border-slate-300 px-2 py-1 text-sm" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
                Apply filters
              </button>
            </div>
          </form>
          <div className="space-y-3">
            {listingsFiltered.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        {item.status || "unknown"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {item.city || "Unknown city"} · Beds {item.bedrooms ?? "-"} · Baths {item.bathrooms ?? "-"} · Type {item.listing_type || "n/a"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Price: {item.currency || "NGN"} {item.price ?? 0}
                    </p>
                    <p className="text-[11px] text-slate-500 break-all">ID: {item.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin?tab=review&id=${encodeURIComponent(item.id)}&view=all`}
                      className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-800"
                    >
                      Open drawer
                    </Link>
                    <Link
                      href={`/dashboard/properties/${encodeURIComponent(item.id)}`}
                      className="rounded border border-sky-300 px-3 py-1 text-sm text-sky-700"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {!listingsFiltered.length && (
              <p className="text-sm text-slate-600">No listings match these filters.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
