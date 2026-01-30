import { computeListingReadiness } from "@/lib/properties/listing-readiness";
import type { PropertyImage } from "@/lib/types";
import { computeLocationQuality } from "@/lib/properties/location-quality";
import { ADMIN_REVIEW_QUEUE_SELECT, normalizeSelect } from "@/lib/admin/admin-review-contracts";
import { assertNoForbiddenColumns } from "@/lib/admin/admin-review-schema-allowlist";
import { hasServerSupabaseEnv, type createServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import {
  getAdminReviewQueue,
  isReviewableRow,
  isFixRequestRow,
  normalizeStatus,
} from "@/lib/admin/admin-review-queue";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

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

export type ReviewLoadResult = {
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

export async function loadReviewListings(
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
            contractDegraded: (queueResult.meta as { contractDegraded?: boolean })?.contractDegraded,
          }
        : null,
      dataCount,
      rowsCount,
    });
    const listings = (queueResult.rows ?? queueResult.data ?? []) as RawProperty[];
    const ownerIds = Array.from(new Set(listings.map((p) => p.owner_id).filter(Boolean))) as string[];
    let owners: Record<string, string> = {};
    if (ownerIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);
      owners = Object.fromEntries(
        (profiles as { id: string; full_name?: string | null }[] | null | undefined)?.map((p) => [p.id, p.full_name || "Host"]) ?? []
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
