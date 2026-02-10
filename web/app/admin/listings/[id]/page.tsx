import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { formatRoleLabel } from "@/lib/roles";
import { computeListingReadiness } from "@/lib/properties/listing-readiness";
import { computeLocationQuality } from "@/lib/properties/location-quality";
import type { PropertyImage } from "@/lib/types";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import { normalizeStatus, isReviewableRow, isFixRequestRow } from "@/lib/admin/admin-review-queue";
import { ADMIN_REVIEW_QUEUE_SELECT, ADMIN_REVIEW_VIEW_TABLE, normalizeSelect } from "@/lib/admin/admin-review-contracts";
import { assertNoForbiddenColumns } from "@/lib/admin/admin-review-schema-allowlist";
import AdminListingInspectorPanel from "@/components/admin/AdminListingInspectorPanel";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

type RawReviewRow = {
  id: string;
  title?: string | null;
  city?: string | null;
  state_region?: string | null;
  country_code?: string | null;
  admin_area_1?: string | null;
  admin_area_2?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  is_approved?: boolean | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  is_active?: boolean | null;
  owner_id?: string | null;
  photo_count?: number | null;
  has_cover?: boolean | null;
  cover_image_url?: string | null;
  has_video?: boolean | null;
  video_count?: number | null;
  price?: number | null;
  currency?: string | null;
  rent_period?: string | null;
  rental_type?: string | null;
  listing_type?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  is_demo?: boolean | null;
};

type OwnerProfile = { id: string; full_name: string | null; role: string | null };

export default async function AdminListingInspectorPage({ params }: Props) {
  const { id } = await params;
  const requestHeaders = await headers();
  const requestId =
    requestHeaders.get("x-vercel-id") ?? requestHeaders.get("x-request-id") ?? null;

  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Supabase env missing. Configure SUPABASE_* server keys to view listings.
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/required?redirect=/admin/listings/${encodeURIComponent(id)}&reason=auth`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const select = normalizeSelect(ADMIN_REVIEW_QUEUE_SELECT);
  assertNoForbiddenColumns(select, "admin listing inspector");

  const detailResult = await client.from(ADMIN_REVIEW_VIEW_TABLE).select(select).eq("id", id).maybeSingle();

  if (detailResult.error || !detailResult.data) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold text-amber-950">Unable to load listing</div>
          <p className="mt-1">{detailResult.error?.message || "Listing not found."}</p>
          {requestId && <p className="mt-1 text-xs text-amber-700">Request ID: {requestId}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/api/admin/review/diagnostics" className="underline">
              Open diagnostics
            </Link>
            <Link href="/admin/listings" className="underline">
              Back to Listings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const row = detailResult.data as unknown as RawReviewRow;
  const { data: ownerProfile } = row.owner_id
    ? await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", row.owner_id)
        .maybeSingle()
    : { data: null };
  const { data: demoRow } = await client
    .from("properties")
    .select("id,is_demo")
    .eq("id", id)
    .maybeSingle();

  const ownerName =
    (ownerProfile as OwnerProfile | null)?.full_name ||
    formatRoleLabel((ownerProfile as OwnerProfile | null)?.role || undefined) ||
    "Host";

  const readiness = computeListingReadiness({
    ...(row as object),
    images: [] as PropertyImage[],
  } as Parameters<typeof computeListingReadiness>[0]);
  const locationQuality = computeLocationQuality({
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    location_label: row.location_label ?? null,
    location_place_id: row.location_place_id ?? null,
    country_code: row.country_code ?? null,
    admin_area_1: row.admin_area_1 ?? row.state_region ?? null,
    admin_area_2: row.admin_area_2 ?? null,
    postal_code: row.postal_code ?? null,
    city: row.city ?? null,
  });

  const reviewable = isReviewableRow({
    status: row.status ?? null,
    submitted_at: row.submitted_at ?? null,
    is_approved: row.is_approved ?? null,
    approved_at: row.approved_at ?? null,
    rejected_at: row.rejected_at ?? null,
  });
  const fixRequested = isFixRequestRow({
    status: row.status ?? null,
    submitted_at: row.submitted_at ?? null,
    rejection_reason: row.rejection_reason ?? null,
    is_approved: row.is_approved ?? null,
    approved_at: row.approved_at ?? null,
  });
  const reviewStage: AdminReviewListItem["reviewStage"] = fixRequested
    ? "changes"
    : reviewable
      ? "pending"
      : null;

  const listing: AdminReviewListItem = {
    id: row.id,
    title: row.title || "Untitled",
    hostName: ownerName,
    ownerId: row.owner_id ?? null,
    updatedAt: row.updated_at || row.created_at || null,
    city: row.city ?? null,
    state_region: row.state_region ?? null,
    country_code: row.country_code ?? null,
    readiness,
    locationQuality: locationQuality.quality,
    photoCount: typeof row.photo_count === "number" ? row.photo_count : 0,
    hasVideo: !!row.has_video || (row.video_count ?? 0) > 0,
    hasCover: row.has_cover ?? (row.photo_count && row.photo_count > 0 ? true : null),
    coverImageUrl: row.cover_image_url ?? null,
    status: normalizeStatus(row.status ?? null),
    submitted_at: row.submitted_at ?? null,
    is_approved: row.is_approved ?? null,
    approved_at: row.approved_at ?? null,
    rejected_at: row.rejected_at ?? null,
    is_active: row.is_active ?? null,
    rejectionReason: row.rejection_reason ?? null,
    price: row.price ?? null,
    currency: row.currency ?? null,
    rent_period: row.rent_period ?? null,
    rental_type: row.rental_type ?? null,
    listing_type: row.listing_type ?? null,
    bedrooms: row.bedrooms ?? null,
    bathrooms: row.bathrooms ?? null,
    is_demo: !!(demoRow as { is_demo?: boolean | null } | null)?.is_demo,
    reviewable,
    reviewStage,
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4">
      <AdminListingInspectorPanel listing={listing} backHref="/admin/listings" />
    </div>
  );
}
