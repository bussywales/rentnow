import { NextResponse, type NextRequest } from "next/server";
import type { Property } from "@/lib/types";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/authz";
import { normalizeRole } from "@/lib/roles";
import { searchProperties } from "@/lib/search";
import {
  filterShortletRowsByDateAvailability,
  isNigeriaDestinationQuery,
  isWithinBounds,
  mapShortletSearchRowsToResultItems,
  matchesShortletDestination,
  matchesTrustFilters,
  parseShortletSearchFilters,
  sortShortletSearchResults,
  type ShortletSearchPropertyRow,
  type ShortletOverlapRow,
} from "@/lib/shortlet/search";
import { resolveShortletBookingMode, resolveShortletNightlyPriceMinor } from "@/lib/shortlet/discovery";

const routeLabel = "/api/shortlets/search";
const MAX_SOURCE_ROWS = 600;

type ProfileTrustRow = {
  id: string;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  bank_verified?: boolean | null;
};

function isDateRangeValid(checkIn: string, checkOut: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkIn < checkOut;
}

function parseOverlapRows(input: Array<Record<string, unknown>> | null, startKey: string, endKey: string) {
  return ((input ?? []).map((row) => ({
    property_id: String(row.property_id || ""),
    start: String(row[startKey] || ""),
    end: String(row[endKey] || ""),
  })) as ShortletOverlapRow[]).filter(
    (row) => !!row.property_id && /^\d{4}-\d{2}-\d{2}$/.test(row.start) && /^\d{4}-\d{2}-\d{2}$/.test(row.end)
  );
}

type DebugReason =
  | "destination_mismatch"
  | "bbox_mismatch"
  | "trust_filter_mismatch"
  | "booking_mode_mismatch"
  | "availability_conflict";

function appendReason(map: Map<string, Set<DebugReason>>, propertyId: string, reason: DebugReason) {
  const existing = map.get(propertyId);
  if (existing) {
    existing.add(reason);
    return;
  }
  map.set(propertyId, new Set([reason]));
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const filters = parseShortletSearchFilters(request.nextUrl.searchParams);
  const hasDateRange = !!filters.checkIn && !!filters.checkOut;
  if (hasDateRange && !isDateRangeValid(filters.checkIn as string, filters.checkOut as string)) {
    return NextResponse.json(
      { error: "Invalid date range. checkOut must be after checkIn." },
      { status: 422 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const debugRequested = request.nextUrl.searchParams.get("debug") === "1";
    let viewerRole: ReturnType<typeof normalizeRole> = null;
    if (debugRequested && process.env.NODE_ENV !== "production") {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          viewerRole = normalizeRole(await getUserRole(supabase, user.id));
        }
      } catch {
        viewerRole = null;
      }
    }
    const debugEnabled =
      debugRequested && process.env.NODE_ENV !== "production" && viewerRole === "admin";

    const { data, error } = await searchProperties(
      {
        city: null,
        minPrice: null,
        maxPrice: null,
        currency: null,
        bedrooms: null,
        bedroomsMode: "exact",
        includeSimilarOptions: false,
        propertyType: null,
        listingIntent: "rent",
        stay: "shortlet",
        rentalType: null,
        furnished: null,
        amenities: [],
      },
      {
        page: 1,
        pageSize: MAX_SOURCE_ROWS,
        includeDemo: false,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message || "Unable to search shortlets." }, { status: 400 });
    }

    const baselineRows = ((data as Property[] | null) ?? []).map((row) => ({ ...row }));
    const debugReasons = new Map<string, Set<DebugReason>>();
    const ownerIds = Array.from(new Set(baselineRows.map((row) => row.owner_id).filter(Boolean)));

    const verifiedHostIds = new Set<string>();
    if (ownerIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id,email_verified,phone_verified,bank_verified")
        .in("id", ownerIds);
      for (const row of ((profileRows as ProfileTrustRow[] | null) ?? [])) {
        const trusted = !!row.email_verified || !!row.phone_verified || !!row.bank_verified;
        if (trusted) verifiedHostIds.add(String(row.id || ""));
      }
    }

    const destinationFilteredRows = baselineRows.filter((property) => {
      const matchesDestination = matchesShortletDestination(property, filters.where);
      if (!matchesDestination && debugEnabled) {
        appendReason(debugReasons, property.id, "destination_mismatch");
      }
      return matchesDestination;
    });

    const bboxFilteredRows = destinationFilteredRows.filter((property) => {
      const withinBounds = isWithinBounds(property, filters.bounds);
      if (!withinBounds && debugEnabled) {
        appendReason(debugReasons, property.id, "bbox_mismatch");
      }
      return withinBounds;
    });

    let rows = bboxFilteredRows.filter((property) => {
      if (!matchesTrustFilters({ property, trustFilters: filters.trust, verifiedHostIds })) {
        if (debugEnabled) appendReason(debugReasons, property.id, "trust_filter_mismatch");
        return false;
      }
      if (filters.provider.bookingMode) {
        const bookingMode = resolveShortletBookingMode(property);
        if (bookingMode !== filters.provider.bookingMode) {
          if (debugEnabled) appendReason(debugReasons, property.id, "booking_mode_mismatch");
          return false;
        }
      }
      return true;
    });

    let unavailablePropertyIds = new Set<string>();
    if (hasDateRange && rows.length > 0) {
      const propertyIds = rows.map((row) => row.id);
      const queryClient = hasServiceRoleEnv()
        ? (createServiceRoleClient() as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>)
        : supabase;

      const [bookingsResult, blocksResult] = await Promise.all([
        queryClient
          .from("shortlet_bookings")
          .select("property_id,check_in,check_out")
          .in("property_id", propertyIds)
          .in("status", ["pending_payment", "pending", "confirmed"])
          .lt("check_in", filters.checkOut as string)
          .gt("check_out", filters.checkIn as string),
        queryClient
          .from("shortlet_blocks")
          .select("property_id,date_from,date_to")
          .in("property_id", propertyIds)
          .lt("date_from", filters.checkOut as string)
          .gt("date_to", filters.checkIn as string),
      ]);

      const bookedOverlaps = parseOverlapRows(
        bookingsResult.data as Array<Record<string, unknown>> | null,
        "check_in",
        "check_out"
      );
      const blockedOverlaps = parseOverlapRows(
        blocksResult.data as Array<Record<string, unknown>> | null,
        "date_from",
        "date_to"
      );

      const availabilityFiltered = filterShortletRowsByDateAvailability({
        rows,
        checkIn: filters.checkIn,
        checkOut: filters.checkOut,
        bookedOverlaps,
        blockedOverlaps,
      });
      rows = availabilityFiltered.rows;
      unavailablePropertyIds = availabilityFiltered.unavailablePropertyIds;
      if (debugEnabled) {
        for (const propertyId of unavailablePropertyIds) {
          appendReason(debugReasons, propertyId, "availability_conflict");
        }
      }
    }

    const recommendedCenter = filters.bounds
      ? {
          latitude: (filters.bounds.north + filters.bounds.south) / 2,
          longitude: (filters.bounds.east + filters.bounds.west) / 2,
        }
      : null;
    const sorted = sortShortletSearchResults(rows, filters.sort, {
      verifiedHostIds,
      recommendedCenter,
      applyNigeriaBoost: !filters.where || isNigeriaDestinationQuery(filters.where),
    });
    const total = sorted.length;
    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize;
    const items = mapShortletSearchRowsToResultItems(
      sorted.slice(from, to) as unknown as ShortletSearchPropertyRow[]
    ).map((item) => ({
      ...item,
      verifiedHost: verifiedHostIds.has(item.owner_id),
    }));
    const mapItems = items
      .filter((item) => item.hasCoords)
      .map((item) => ({
        id: item.id,
        title: item.title,
        city: item.city,
        currency: item.currency,
        nightlyPriceMinor: resolveShortletNightlyPriceMinor(item),
        primaryImageUrl: item.primaryImageUrl ?? item.cover_image_url ?? null,
        latitude: item.latitude,
        longitude: item.longitude,
      }));

    const hasNearbySuggestion = total === 0 && !!filters.bounds;

    const payload: Record<string, unknown> = {
      ok: true,
      route: routeLabel,
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      items,
      mapItems,
      nearbyAlternatives: hasNearbySuggestion
        ? [{ label: "Expand map area", hint: "Try searching a wider area nearby." }]
        : [],
      filters: {
        where: filters.where,
        checkIn: filters.checkIn,
        checkOut: filters.checkOut,
        guests: filters.guests,
        marketCountry: filters.marketCountry,
        bbox: filters.bounds,
        bounds: filters.bounds,
        sort: filters.sort,
        trust: filters.trust,
        bookingMode: filters.provider.bookingMode,
      },
    };

    if (debugEnabled) {
      const finalIds = new Set(sorted.map((row) => row.id));
      const missingFromBaseline = baselineRows
        .filter((row) => !finalIds.has(row.id))
        .map((row) => ({
          id: row.id,
          title: row.title,
          country_code: row.country_code ?? null,
          country: row.country ?? null,
          currency: row.currency ?? null,
          hasCoords:
            typeof row.latitude === "number" &&
            Number.isFinite(row.latitude) &&
            typeof row.longitude === "number" &&
            Number.isFinite(row.longitude),
          reasons: Array.from(debugReasons.get(row.id) ?? []),
        }));

      payload.__debug = {
        baselineCount: baselineRows.length,
        destinationFiltered: destinationFilteredRows.length,
        bboxFiltered: bboxFilteredRows.length,
        final: sorted.length,
        pagedCount: items.length,
        mapCount: mapItems.length,
        availabilityConflictCount: unavailablePropertyIds.size,
        missingFromBaseline: missingFromBaseline.slice(0, 100),
      };
    }

    const cacheControl = debugEnabled
      ? "private, no-store"
      : hasDateRange
      ? "private, no-store"
      : "public, s-maxage=120, stale-while-revalidate=300";

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    console.error("[api/shortlets/search] failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Unable to load shortlet search results." },
      { status: 500 }
    );
  }
}
