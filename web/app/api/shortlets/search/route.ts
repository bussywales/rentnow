import { NextResponse, type NextRequest } from "next/server";
import type { Property } from "@/lib/types";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { searchProperties } from "@/lib/search";
import {
  filterShortletListingsByMarket,
  filterToShortletListings,
  isWithinBounds,
  mapShortletSearchRowsToResultItems,
  matchesShortletSearchQuery,
  matchesTrustFilters,
  parseShortletSearchFilters,
  sortShortletSearchResults,
  unavailablePropertyIdsForDateRange,
  type ShortletSearchPropertyRow,
  type ShortletOverlapRow,
} from "@/lib/shortlet/search";
import { resolveShortletBookingMode } from "@/lib/shortlet/discovery";

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

    const sourceRows = filterShortletListingsByMarket(
      filterToShortletListings((data as Property[] | null) ?? []),
      filters.marketCountry
    );
    const ownerIds = Array.from(new Set(sourceRows.map((row) => row.owner_id).filter(Boolean)));

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

    let rows = sourceRows.filter((property) => {
      if (!matchesShortletSearchQuery(property, filters.q)) return false;
      if (!isWithinBounds(property, filters.bounds)) return false;
      if (!matchesTrustFilters({ property, trustFilters: filters.trust, verifiedHostIds })) return false;
      if (filters.provider.bookingMode) {
        const bookingMode = resolveShortletBookingMode(property);
        if (bookingMode !== filters.provider.bookingMode) return false;
      }
      return true;
    });

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

      const unavailablePropertyIds = unavailablePropertyIdsForDateRange({
        checkIn: filters.checkIn as string,
        checkOut: filters.checkOut as string,
        bookedOverlaps,
        blockedOverlaps,
      });
      rows = rows.filter((row) => !unavailablePropertyIds.has(row.id));
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
    });
    const total = sorted.length;
    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize;
    const items = mapShortletSearchRowsToResultItems(
      sorted.slice(from, to) as unknown as ShortletSearchPropertyRow[]
    );

    const hasNearbySuggestion = total === 0 && !!filters.bounds;

    const payload = {
      ok: true,
      route: routeLabel,
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      items,
      nearbyAlternatives: hasNearbySuggestion
        ? [{ label: "Expand map area", hint: "Try searching a wider area nearby." }]
        : [],
      filters: {
        q: filters.q,
        checkIn: filters.checkIn,
        checkOut: filters.checkOut,
        guests: filters.guests,
        marketCountry: filters.marketCountry,
        bounds: filters.bounds,
        sort: filters.sort,
        trust: filters.trust,
        bookingMode: filters.provider.bookingMode,
      },
    };

    const cacheControl = hasDateRange
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
