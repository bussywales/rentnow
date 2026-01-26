import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReviewDesk } from "@/components/admin/AdminReviewDesk";
import { ADMIN_REVIEW_COPY } from "@/lib/admin/admin-review-microcopy";
import { buildSelectedUrl, type AdminReviewListItem } from "@/lib/admin/admin-review";
import { computeListingReadiness } from "@/lib/properties/listing-readiness";
import type { PropertyImage } from "@/lib/types";
import { computeLocationQuality } from "@/lib/properties/location-quality";
import { hasServerSupabaseEnv, type createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { formatRoleLabel } from "@/lib/roles";
import {
  buildStatusOrFilter,
  getAdminReviewQueue,
  getStatusesForView,
  isReviewableRow,
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
  };
};

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

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
    const queueSelect = [
      "id",
      "status",
      "updated_at",
      "submitted_at",
      "is_approved",
      "approved_at",
      "rejected_at",
      "is_active",
    ].join(",");
    const detailSelect = [
      "id",
      "title",
      "owner_id",
      "city",
      "state_region",
      "country_code",
      "admin_area_1",
      "admin_area_2",
      "postal_code",
      "latitude",
      "longitude",
      "location_label",
      "location_place_id",
      "created_at",
      "updated_at",
      "rejection_reason",
    ].join(",");
    const queueResult = await getAdminReviewQueue({
      userClient: supabase,
      serviceClient,
      viewerRole,
      select: queueSelect,
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

    const listings = (queueResult.data ?? []) as RawProperty[];
    console.log("[admin/review] rows", listings.length);
    const listingIds = Array.from(new Set(listings.map((p) => p.id).filter(Boolean)));

    let detailMap: Record<string, RawProperty> = {};
    if (listingIds.length) {
      const detailClient = serviceClient ?? supabase;
      const { data: details, error: detailError, status: detailStatus } = await detailClient
        .from("properties")
        .select(detailSelect)
        .in("id", listingIds);
      if (detailError) {
        console.warn("[admin/review] detail fetch error", detailStatus, detailError);
      }
      detailMap = Object.fromEntries(((details ?? []) as RawProperty[]).map((row) => [row.id, row]));
      console.log("[admin/review] detail rows", { count: details?.length ?? 0, status: detailStatus });
    }

    let imageMap: Record<string, PropertyImage[]> = {};
    if (listingIds.length) {
      const mediaClient = serviceClient ?? supabase;
      const { data: images, error: imageError, status: imageStatus } = await mediaClient
        .from("property_images")
        .select("id,image_url,width,height,property_id,created_at")
        .in("property_id", listingIds);
      if (imageError) {
        console.warn("[admin/review] property_images fetch error", imageStatus, imageError);
      }
      imageMap = (images ?? []).reduce((acc, img, idx) => {
        const propertyId = (img as { property_id?: string | null }).property_id;
        if (!propertyId) return acc;
        const list = acc[propertyId] || [];
        list.push({
          id: (img as { id?: string }).id || `img-${propertyId}-${list.length}-${idx}`,
          image_url: (img as { image_url?: string }).image_url || "",
          width: (img as { width?: number | null }).width ?? undefined,
          height: (img as { height?: number | null }).height ?? undefined,
          position: list.length,
          created_at: (img as { created_at?: string | null }).created_at || undefined,
        });
        acc[propertyId] = list;
        return acc;
      }, {} as Record<string, PropertyImage[]>);
      console.log("[admin/review] media rows", { images: images?.length ?? 0, status: imageStatus });
    }

    let videoCount: Record<string, number> = {};
    if (listingIds.length) {
      const mediaClient = serviceClient ?? supabase;
      const { data: videos, error: videoError, status: videoStatus } = await mediaClient
        .from("property_videos")
        .select("id,property_id")
        .in("property_id", listingIds);
      if (videoError) {
        console.warn("[admin/review] property_videos fetch error", videoStatus, videoError);
      }
      videoCount = (videos ?? []).reduce((acc, video) => {
        const propertyId = (video as { property_id?: string | null }).property_id;
        if (!propertyId) return acc;
        acc[propertyId] = (acc[propertyId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log("[admin/review] video rows", { videos: videos?.length ?? 0, status: videoStatus });
    }

    const ownerIds = Array.from(
      new Set(
        listings
          .map((p) => {
            const detail = detailMap[p.id];
            return detail?.owner_id || p.owner_id;
          })
          .filter(Boolean)
      )
    ) as string[];
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
      const detail = detailMap[p.id] || {};
      const merged = { ...detail, ...p, id: p.id } as RawProperty;
      const images = imageMap[p.id] || [];
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
        photoCount: images.length,
        hasVideo: (videoCount[p.id] || 0) > 0,
        reviewable: isReviewableRow({
          status: merged.status ?? null,
          submitted_at: merged.submitted_at ?? null,
          is_approved: merged.is_approved ?? null,
          approved_at: merged.approved_at ?? null,
          rejected_at: merged.rejected_at ?? null,
        }),
      };
    });
    return {
      listings: mappedListings,
      serviceRoleAvailable: !!serviceClient,
      serviceRoleError: queueResult.serviceRoleError,
      queueSource: queueResult.meta.source,
      serviceRoleStatus: queueResult.meta.serviceStatus ?? queueResult.serviceRoleStatus,
      meta: queueResult.meta,
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
    serviceRoleAvailable,
    serviceRoleStatus,
    meta,
  } = await loadReviewListings(supabase, profile?.role ?? null);
  const showServiceWarning = meta?.serviceAttempted === true && meta?.serviceOk === false;
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
      {showServiceWarning && !serviceRoleAvailable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {ADMIN_REVIEW_COPY.warnings.missingServiceRole}
        </div>
      )}
      {showServiceWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Service fetch status: {meta?.serviceStatus ?? serviceRoleStatus}. See diagnostics.
        </div>
      )}
      <AdminReviewDesk listings={listings} initialSelectedId={initialSelectedId} />
      <link rel="canonical" href={canonicalUrl} />
    </div>
  );
}
