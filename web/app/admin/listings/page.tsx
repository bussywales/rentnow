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
import { normalizeStatus, isReviewableRow, isFixRequestRow, ALLOWED_PROPERTY_STATUSES } from "@/lib/admin/admin-review-queue";
import {
  getAdminAllListings,
  isUuid,
  parseAdminListingsQuery,
  serializeAdminListingsQuery,
  hasActiveAdminListingsFilters,
} from "@/lib/admin/admin-listings";
import AdminListingsPanelClient from "@/components/admin/AdminListingsPanelClient";
import AdminListingsFiltersClient from "@/components/admin/AdminListingsFiltersClient";
import AdminListingsAppliedFiltersClient from "@/components/admin/AdminListingsAppliedFiltersClient";
import AdminSavedViews from "@/components/admin/AdminSavedViews";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const STATUS_OPTIONS = ALLOWED_PROPERTY_STATUSES.map((status) => ({
  value: status,
  label: status.toUpperCase(),
}));

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams?: SearchParams | Promise<SearchParams>;
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
};

type OwnerProfile = { id: string; full_name: string | null; role: string | null };

type ListingsPageData = {
  listings: AdminReviewListItem[];
  listingQuery: ReturnType<typeof parseAdminListingsQuery>;
  listingCount: number;
  listingPage: number;
  listingPageSize: number;
  listingTotalCount: number;
  contractDegraded: boolean;
  error: string | null;
  requestId: string | null;
  ownerSummary: { id: string; name: string; role: string | null } | null;
};

async function resolveSearchParams(raw?: SearchParams | Promise<SearchParams>) {
  if (raw && typeof (raw as { then?: unknown }).then === "function") {
    return (raw as Promise<SearchParams>);
  }
  return raw ?? {};
}

async function getListingsData(
  rawSearchParams?: SearchParams | Promise<SearchParams>
): Promise<ListingsPageData> {
  const searchParams = await resolveSearchParams(rawSearchParams);
  const listingQuery = parseAdminListingsQuery(searchParams);
  const requestHeaders = await headers();
  const requestId =
    requestHeaders.get("x-vercel-id") ?? requestHeaders.get("x-request-id") ?? null;

  if (!hasServerSupabaseEnv()) {
    return {
      listings: [],
      listingQuery,
      listingCount: 0,
      listingPage: listingQuery.page,
      listingPageSize: listingQuery.pageSize,
      listingTotalCount: 0,
      contractDegraded: false,
      error: "Supabase env missing",
      requestId,
      ownerSummary: null,
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/required?redirect=/admin/listings&reason=auth`);
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
  try {
    const result = await getAdminAllListings<RawReviewRow>({
      client,
      query: listingQuery,
    });

    const rows = result.rows ?? [];
    const ownerIds = Array.from(
      new Set(rows.map((row) => row.owner_id).filter(Boolean))
    ) as string[];

    const { data: ownerProfiles } = ownerIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("id", ownerIds)
      : { data: [] };

    const owners = Object.fromEntries(
      ((ownerProfiles as OwnerProfile[]) || []).map((p) => [
        p.id,
        p.full_name || formatRoleLabel(p.role || undefined) || "Host",
      ])
    );

    const listings = rows.map((row) => {
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

      return {
        id: row.id,
        title: row.title || "Untitled",
        hostName: owners[row.owner_id || ""] || "Host",
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
        reviewable,
        reviewStage,
      };
    });

    let ownerSummary: ListingsPageData["ownerSummary"] = null;
    if (listingQuery.qMode === "owner" && listingQuery.q && isUuid(listingQuery.q)) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", listingQuery.q)
        .maybeSingle();
      if (ownerProfile) {
        ownerSummary = {
          id: ownerProfile.id,
          name: ownerProfile.full_name || formatRoleLabel(ownerProfile.role || undefined) || "Host",
          role: ownerProfile.role ?? null,
        };
      }
    }

    return {
      listings,
      listingQuery,
      listingCount: rows.length,
      listingPage: result.page,
      listingPageSize: result.pageSize,
      listingTotalCount: result.count,
      contractDegraded: result.contractDegraded,
      error: null,
      requestId,
      ownerSummary,
    };
  } catch (err) {
    return {
      listings: [],
      listingQuery,
      listingCount: 0,
      listingPage: listingQuery.page,
      listingPageSize: listingQuery.pageSize,
      listingTotalCount: 0,
      contractDegraded: false,
      error: (err as Error)?.message ?? "Failed to load listings",
      requestId,
      ownerSummary: null,
    };
  }
}

export default async function AdminListingsPage({ searchParams }: Props) {
  const {
    listings,
    listingQuery,
    listingCount,
    listingPage,
    listingPageSize,
    listingTotalCount,
    contractDegraded,
    error,
    requestId,
    ownerSummary,
  } = await getListingsData(searchParams);

  const listingStart = listingTotalCount > 0 ? (listingPage - 1) * listingPageSize + 1 : 0;
  const listingEnd =
    listingTotalCount > 0 ? Math.min(listingTotalCount, listingStart + listingCount - 1) : 0;

  const hasActiveFilters = hasActiveAdminListingsFilters(listingQuery);
  const buildPageHref = (page: number) => {
    const params = serializeAdminListingsQuery({
      ...listingQuery,
      page,
      pageSize: listingPageSize,
    });
    const qs = params.toString();
    return qs ? `/admin/listings?${qs}` : "/admin/listings";
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
            <h1 className="text-2xl font-semibold text-slate-900">Listings registry</h1>
            <p className="text-sm text-slate-600">
              All listings, searchable and filterable. Read-only operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/admin" className="rounded border border-slate-200 bg-white px-3 py-1 shadow-sm">
              Back to overview
            </Link>
            <Link href="/admin/review" className="rounded border border-slate-200 bg-white px-3 py-1 shadow-sm">
              Review queue
            </Link>
          </div>
        </div>
        <p className="text-sm text-slate-600">Total listings: {listingTotalCount}</p>
        <div className="mt-3">
          <AdminSavedViews route="/admin/listings" />
        </div>
      </div>

      {(error || contractDegraded) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold text-amber-950">Listings may be incomplete</div>
          <p className="mt-1">{error || "Contract degraded. Apply the admin_review_view migration."}</p>
          {requestId && <p className="mt-1 text-xs text-amber-700">Request ID: {requestId}</p>}
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

      {ownerSummary && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm shadow-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Owner drilldown</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{ownerSummary.name}</div>
          <div className="text-xs text-slate-600">ID: {ownerSummary.id}</div>
          <div className="text-xs text-slate-600">Role: {ownerSummary.role || "Host"}</div>
          <div className="mt-1 text-xs text-slate-600">
            Listings found for owner: {listingTotalCount}
          </div>
        </div>
      )}

      <AdminListingsFiltersClient
        initialQuery={listingQuery}
        statusOptions={STATUS_OPTIONS}
        pageSizeOptions={[25, 50, 100]}
      />

      <AdminListingsAppliedFiltersClient query={listingQuery} />

      <div className="text-sm text-slate-600">
        Showing {listingStart}-{listingEnd} of {listingTotalCount} listings
        {hasActiveFilters ? " (filtered)" : ""}.
      </div>

      {listingTotalCount === 0 && hasActiveFilters ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-600 shadow-sm">
          <div className="text-base font-semibold text-slate-900">
            No listings match your filters.
          </div>
          <p className="mt-1">Try clearing filters or adjusting your criteria.</p>
          <div className="mt-3">
            <Link
              href="/admin/listings"
              className="rounded border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
            >
              Clear filters
            </Link>
          </div>
        </div>
      ) : (
        <AdminListingsPanelClient listings={listings} />
      )}

      {listingTotalCount > listingPageSize && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm">
          <Link
            href={buildPageHref(Math.max(1, listingPage - 1))}
            className={`rounded border border-slate-200 bg-white px-3 py-1 shadow-sm ${listingPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
          >
            Previous
          </Link>
          <span>
            Page {listingPage} of {Math.max(1, Math.ceil(listingTotalCount / listingPageSize))}
          </span>
          <Link
            href={buildPageHref(listingPage + 1)}
            className={`rounded border border-slate-200 bg-white px-3 py-1 shadow-sm ${
              listingPage >= Math.ceil(listingTotalCount / listingPageSize) ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
