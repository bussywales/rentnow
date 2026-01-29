import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReviewDesk } from "@/components/admin/AdminReviewDesk";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import { buildSelectedUrl, type AdminReviewListItem } from "@/lib/admin/admin-review";
import { computeListingReadiness } from "@/lib/properties/listing-readiness";
import type { PropertyImage } from "@/lib/types";
import { computeLocationQuality } from "@/lib/properties/location-quality";
import { ADMIN_REVIEW_QUEUE_SELECT, normalizeSelect } from "@/lib/admin/admin-review-contracts";
import { assertNoForbiddenColumns } from "@/lib/admin/admin-review-schema-allowlist";
import { hasServerSupabaseEnv, type createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { formatRoleLabel } from "@/lib/roles";
import {
  buildStatusOrFilter,
  getAdminReviewQueue,
  getStatusesForView,
  isReviewableRow,
  isFixRequestRow,
  normalizeStatus,
} from "@/lib/admin/admin-review-queue";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type RawProperty = {
  id: string;
  title?: string | null;
  city?: string | null;
  state_region?: string | null;
  country_code?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  owner_id?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  is_approved?: boolean | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  is_active?: boolean | null;
  photo_count?: number | null;
  has_cover?: boolean | null;
  cover_image_url?: string | null;
  has_video?: boolean | null;
  video_count?: number | null;
  rejection_reason?: string | null;
  admin_area_1?: string | null;
  admin_area_2?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
};

type ReviewLoadResult = {
  listings: AdminReviewListItem[];
  serviceRoleAvailable: boolean;
  serviceRoleError: unknown;
  queueSource: "service" | "user";
  serviceRoleStatus: number | null;
  meta?: {
    source: "service" | "user";
    serviceAttempted: boolean;
    serviceOk: boolean;
    serviceStatus: number | null;
    serviceError?: string;
    contractDegraded?: boolean;
    contractError?: { code?: string; message?: string } | null;
  };
};

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function AdminReviewServiceErrorPanel({ meta, status }: { meta: ReviewLoadResult["meta"]; status: number | null }) {
  const debugJson = JSON.stringify(
    {
      serviceAttempted: meta?.serviceAttempted,
      serviceOk: meta?.serviceOk,
      serviceStatus: meta?.serviceStatus ?? status,
      serviceError: meta?.serviceError,
      serviceErrorDetails: (meta as { serviceErrorDetails?: string })?.serviceErrorDetails,
      fallbackReason: (meta as { fallbackReason?: string })?.fallbackReason,
    },
    null,
    2
  );
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <div className="font-semibold text-amber-900">Queue fetch failed</div>
      <div className="mt-1">
        Service fetch status: {meta?.serviceStatus ?? status}. See{" "}
        <a className="underline" href="/api/admin/review/diagnostics" target="_blank" rel="noreferrer">
          diagnostics
        </a>
        .
      </div>
      <details className="mt-2 rounded bg-white/70 p-2 text-xs text-amber-900">
        <summary className="cursor-pointer text-amber-900">Debug meta</summary>
        <pre className="mt-1 whitespace-pre-wrap">{debugJson}</pre>
      </details>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          className="rounded border border-amber-300 px-2 py-1"
          onClick={() => {
            try {
              void navigator.clipboard?.writeText(debugJson);
            } catch {
              /* ignore */
            }
          }}
        >
          Copy debug JSON
        </button>
      </div>
    </div>
  );
}

async function loadReviewListings(
  supabase: SupabaseServerClient,
  viewerRole: string | null
): Promise<ReviewLoadResult> {
  if (!hasServerSupabaseEnv()) {
    return {
      listings: [],
      serviceRoleAvailable: false,
      serviceRoleError: null,
      queueSource: "user",
      serviceRoleStatus: null,
    };
  }
  try {
    const serviceClient = viewerRole === "admin" && hasServiceRoleEnv() ? createServiceRoleClient() : null;
    assertNoForbiddenColumns(normalizeSelect(ADMIN_REVIEW_QUEUE_SELECT), "admin/review queue");
    const queueResult = await getAdminReviewQueue({
      userClient: supabase,
      serviceClient,
      viewerRole,
      select: ADMIN_REVIEW_QUEUE_SELECT,
      view: "pending",
    });
    const dataIsArray = Array.isArray(queueResult.data);
    const rowsIsArray = Array.isArray(queueResult.rows);
    const dataCount = dataIsArray ? queueResult.data.length : null;
    const rowsCount = rowsIsArray ? queueResult.rows.length : null;
    console.log("[admin/review] queue meta", {
      meta: queueResult.meta
        ? {
            source: queueResult.meta.source,
            serviceAttempted: queueResult.meta.serviceAttempted,
            serviceOk: queueResult.meta.serviceOk,
            serviceStatus: queueResult.meta.serviceStatus,
            serviceError: queueResult.meta.serviceError,
            serviceErrorDetails: (queueResult.meta as { serviceErrorDetails?: string })?.serviceErrorDetails,
            serviceErrorHint: (queueResult.meta as { serviceErrorHint?: string })?.serviceErrorHint,
            serviceErrorCode: (queueResult.meta as { serviceErrorCode?: string })?.serviceErrorCode,
          }
        : null,
      serviceRoleError: queueResult.serviceRoleError,
      serviceRoleStatus: queueResult.serviceRoleStatus,
    });
    console.log("[admin/review] queue rows source", {
      dataIsArray,
      rowsIsArray,
      dataCount,
      rowsCount,
      preferred: rowsIsArray ? "rows" : dataIsArray ? "data" : "none",
    });
    if (queueResult.serviceRoleError) {
      console.warn("[admin/review] service role error", queueResult.serviceRoleError);
    }
    console.log("[admin/review] status set", {
      statuses: getStatusesForView("pending"),
      or: buildStatusOrFilter("pending"),
    });

    const listings = (queueResult.rows ?? queueResult.data ?? []) as RawProperty[];
    console.log("[admin/review] rows", listings.length);

    const ownerIds = Array.from(new Set(listings.map((p) => p.owner_id).filter(Boolean))) as string[];
    let owners: Record<string, string> = {};
    if (ownerIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", ownerIds);
      owners = Object.fromEntries(
        (profiles || [])
          .map((p) => [p.id, p.full_name || formatRoleLabel(p.role as string | undefined) || "Host"])
      );
    }

    const mappedListings = listings.map((p) => {
      const merged = { ...p, id: p.id } as RawProperty;
      const images: PropertyImage[] = [];
      const readinessInput = {
        ...merged,
        images,
      } as Parameters<typeof computeListingReadiness>[0];
      const readiness = computeListingReadiness(readinessInput);
      const locationQuality = computeLocationQuality({
        latitude: merged.latitude ?? null,
        longitude: merged.longitude ?? null,
        location_label: merged.location_label ?? null,
        location_place_id: merged.location_place_id ?? null,
        country_code: merged.country_code ?? null,
        admin_area_1: merged.admin_area_1 ?? merged.state_region ?? null,
        admin_area_2: merged.admin_area_2 ?? null,
        postal_code: merged.postal_code ?? null,
        city: merged.city ?? null,
      });

      const fixRequested = isFixRequestRow({
        status: merged.status ?? null,
        submitted_at: merged.submitted_at ?? null,
        rejection_reason: merged.rejection_reason ?? null,
        is_approved: merged.is_approved ?? null,
        approved_at: merged.approved_at ?? null,
      });
      const reviewable = isReviewableRow({
        status: merged.status ?? null,
        submitted_at: merged.submitted_at ?? null,
        is_approved: merged.is_approved ?? null,
        approved_at: merged.approved_at ?? null,
        rejected_at: merged.rejected_at ?? null,
      });
      const reviewStage: AdminReviewListItem["reviewStage"] = fixRequested
        ? "changes"
        : reviewable
          ? "pending"
          : null;

      return {
        id: p.id,
        title: merged.title || "Untitled",
        hostName: owners[merged.owner_id || ""] || "Host",
        updatedAt: merged.updated_at || merged.created_at || null,
        status: normalizeStatus(merged.status) ?? "pending",
        submitted_at: merged.submitted_at ?? null,
        is_approved: merged.is_approved ?? null,
        approved_at: merged.approved_at ?? null,
        rejected_at: merged.rejected_at ?? null,
        is_active: merged.is_active ?? null,
        rejectionReason: merged.rejection_reason ?? null,
        city: merged.city ?? null,
        state_region: merged.state_region ?? null,
        country_code: merged.country_code ?? null,
        readiness,
        locationQuality: locationQuality.quality,
        photoCount: typeof merged.photo_count === "number" ? merged.photo_count : images.length,
        hasVideo: merged.has_video ?? ((merged.video_count ?? 0) > 0),
        hasCover: merged.has_cover ?? (merged.cover_image_url ? true : null),
        coverImageUrl: merged.cover_image_url ?? null,
        reviewable,
        reviewStage,
      };
    });
    return {
      listings: mappedListings,
      serviceRoleAvailable: !!serviceClient,
      serviceRoleError: queueResult.serviceRoleError,
      queueSource: queueResult.meta.source,
      serviceRoleStatus: queueResult.meta.serviceStatus ?? queueResult.serviceRoleStatus,
      meta: {
        ...queueResult.meta,
        contractDegraded: (queueResult.meta as { contractDegraded?: boolean })?.contractDegraded,
        contractError: (queueResult.meta as { contractError?: { code?: string; message?: string } | null })?.contractError,
      },
    };
  } catch (err) {
    console.warn("admin review desk fetch failed", err);
    return {
      listings: [],
      serviceRoleAvailable: hasServiceRoleEnv(),
      serviceRoleError: err,
      queueSource: "user",
      serviceRoleStatus: null,
      meta: { source: "user", serviceAttempted: hasServiceRoleEnv(), serviceOk: false, serviceStatus: null, serviceError: "fetch failed" },
    };
  }
}

export default async function AdminReviewPage({ searchParams }: Props) {
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/login?reason=auth");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden");
  }

  const {
    listings,
    serviceRoleStatus,
    meta,
  } = await loadReviewListings(supabase, profile?.role ?? null);
  const queueError = meta?.serviceAttempted === true && meta?.serviceOk === false;
  const contractDegraded = meta?.contractDegraded;
  const initialSelectedId = (() => {
    const raw = searchParams?.id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? decodeURIComponent(value) : null;
  })();

  const pathname = "/admin/review";
  const canonicalUrl = initialSelectedId ? buildSelectedUrl(pathname, initialSelectedId) : pathname;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{ADMIN_REVIEW_COPY.headerTitle}</h1>
          <p className="text-sm text-slate-600">{ADMIN_REVIEW_COPY.headerSubtitle}</p>
        </div>
        <Link href="/admin" className="text-sm text-sky-600 hover:text-sky-700">
          Back to Admin
        </Link>
      </div>
      {contractDegraded && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold text-amber-950">Database view is out of date</div>
          <p className="mt-1">
            admin_review_view is missing expected columns (e.g., pricing fields). Apply migration 20260127132459_admin_review_view.sql then rerun diagnostics.
          </p>
          <Link href="/api/admin/review/diagnostics" className="underline">
            Open diagnostics
          </Link>
        </div>
      )}
      {queueError && (
        <AdminReviewServiceErrorPanel meta={meta} status={serviceRoleStatus} />
      )}
      {!queueError && (
        <AdminReviewDesk
          listings={listings}
          initialSelectedId={initialSelectedId}
          allowedViews={["pending", "changes", "all"]}
          viewLabels={{ all: "All reviewable" }}
          actionsEnabled
        />
      )}
      <link rel="canonical" href={canonicalUrl} />
    </div>
  );
}
