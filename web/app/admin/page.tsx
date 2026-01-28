import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyBulkActions } from "@/components/admin/PropertyBulkActions";
import { UpgradeRequestsQueue } from "@/components/admin/UpgradeRequestsQueue";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logApprovalAction } from "@/lib/observability";
import { formatRoleLabel } from "@/lib/roles";
import { buildStatusOrFilter, getAdminReviewQueue, getStatusesForView, isReviewableRow, normalizeStatus } from "@/lib/admin/admin-review-queue";
import { ADMIN_REVIEW_QUEUE_SELECT } from "@/lib/admin/admin-review-contracts";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import { AdminReviewShell } from "@/components/admin/AdminReviewShell";
import { AdminReviewListCards } from "@/components/admin/AdminReviewListCards";
import { computeListingReadiness } from "@/lib/properties/listing-readiness";
import type { PropertyImage } from "@/lib/types";
import { computeLocationQuality } from "@/lib/properties/location-quality";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

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

async function getData() {
  if (!hasServerSupabaseEnv()) {
    return { reviewListings: [], users: [], requests: [], pendingReviewCount: 0, serviceRoleAvailable: false, meta: null };
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

    const pendingResult = await getAdminReviewQueue({
      userClient: supabase,
      serviceClient,
      viewerRole,
      select: ADMIN_REVIEW_QUEUE_SELECT,
      view: "pending",
    });
    console.log("[admin] pending status set", {
      view: "pending",
      statuses: getStatusesForView("pending"),
      or: buildStatusOrFilter("pending"),
      source: pendingResult.meta.source,
      status: pendingResult.meta.serviceStatus,
    });

    const queueRows = (pendingResult.rows ?? pendingResult.data ?? []) as RawReviewRow[];
    const ownerIds = Array.from(new Set(queueRows.map((p) => p.owner_id).filter(Boolean))) as string[];
    const { data: ownerProfiles } = ownerIds.length
      ? await supabase.from("profiles").select("id, full_name, role").in("id", ownerIds)
      : { data: [] };
    const owners = Object.fromEntries(
      (ownerProfiles || []).map((p) => [p.id, p.full_name || formatRoleLabel(p.role) || "Host"])
    );

    const reviewListings: AdminReviewListItem[] = queueRows.map((p) => {
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
        reviewable: isReviewableRow({
          status: p.status ?? null,
          submitted_at: p.submitted_at ?? null,
          is_approved: p.is_approved ?? null,
          approved_at: p.approved_at ?? null,
          rejected_at: p.rejected_at ?? null,
        }),
      };
    });

    return {
      reviewListings,
      users: (users as AdminUser[]) || [],
      requests: (requests as UpgradeRequest[]) || [],
      pendingReviewCount: pendingResult.count ?? (Array.isArray(pendingResult.data) ? pendingResult.data.length : 0),
      serviceRoleAvailable: pendingResult.serviceRoleAvailable,
      serviceRoleError: pendingResult.serviceRoleError,
      queueSource: pendingResult.meta.source,
      serviceRoleStatus: pendingResult.meta.serviceStatus ?? pendingResult.serviceRoleStatus,
      meta: pendingResult.meta,
    };
  } catch (err) {
    console.warn("Admin data load failed; rendering empty state", err);
    return {
      reviewListings: [],
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
  const supabaseReady = hasServerSupabaseEnv();

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

  const {
    reviewListings,
    users,
    requests,
    pendingReviewCount,
    serviceRoleAvailable,
    serviceRoleError,
    queueSource,
    serviceRoleStatus,
    meta,
  } = await getData();
  const upgradePendingCount = requests.filter((request) => request.status === "pending").length;

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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Properties</h2>
            <p className="text-sm text-slate-600">
              Approve or reject listings before they go live. Click a row to open the review drawer.
            </p>
          </div>
          <Link href="/dashboard/properties/new" className="text-sm text-sky-700">
            Create listing
          </Link>
        </div>
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <PropertyBulkActions action={bulkUpdate} />
        </div>
        <AdminReviewShell
          listings={reviewListings}
          initialSelectedId={
            searchParams.id
              ? Array.isArray(searchParams.id)
                ? searchParams.id[0]
                : searchParams.id
              : null
          }
          renderList={({ items, selectedId, onSelect }) => (
            <AdminReviewListCards items={items} selectedId={selectedId} onSelect={onSelect} />
          )}
        />
      </div>

      <UpgradeRequestsQueue initialRequests={requests} users={users} />
    </div>
  );
}
