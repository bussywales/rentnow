import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPropertyEvents, buildSummaryByProperty } from "@/lib/analytics/property-events.server";

export type SupplyHealthRow = {
  id: string;
  title: string | null;
  description: string | null;
  city: string | null;
  status: string | null;
  owner_id: string | null;
  owner_name: string | null;
  updated_at: string | null;
  expires_at: string | null;
  is_featured: boolean | null;
  listing_intent: string | null;
  photo_count: number;
  quality_score: number;
  missing_flags: string[];
  views: number;
  enquiries: number;
};

type SupplyListingRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  city?: string | null;
  location_label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  owner_id?: string | null;
  updated_at?: string | null;
  expires_at?: string | null;
  is_featured?: boolean | null;
  listing_intent?: string | null;
  price?: number | null;
  currency?: string | null;
  created_at?: string | null;
  approved_at?: string | null;
  profiles?: {
    full_name?: string | null;
    email_verified?: boolean | null;
    phone_verified?: boolean | null;
  } | null;
};

export type SupplyHealthSummary = {
  rows: SupplyHealthRow[];
  generatedAt: string;
  rangeDays: number;
};

export function computeQualityScore(input: {
  listing: SupplyListingRow;
  photoCount: number;
}) {
  const missing: string[] = [];
  let score = 0;

  if (input.photoCount >= 8) {
    score += 20;
  } else if (input.photoCount >= 4) {
    score += 20;
  } else if (input.photoCount >= 1) {
    score += 10;
    missing.push("few_photos");
  } else {
    missing.push("no_photos");
  }

  const titleLength = input.listing.title?.trim().length ?? 0;
  if (titleLength >= 20) {
    score += 10;
  } else {
    missing.push("short_title");
  }

  const descriptionLength = input.listing.description?.trim().length ?? 0;
  if (descriptionLength >= 120) {
    score += 10;
  } else {
    missing.push(descriptionLength === 0 ? "no_description" : "short_description");
  }

  const priceOk = typeof input.listing.price === "number" && input.listing.price > 0 && !!input.listing.currency;
  if (priceOk) {
    score += 15;
  } else {
    missing.push("no_price");
  }

  const locationOk =
    !!input.listing.city ||
    !!input.listing.location_label ||
    (!!input.listing.latitude && !!input.listing.longitude);
  if (locationOk) {
    score += 15;
  } else {
    missing.push("no_location");
  }

  if (input.listing.listing_intent) {
    score += 10;
  } else {
    missing.push("no_intent");
  }

  if (input.listing.status === "live") {
    score += 10;
  } else {
    missing.push("not_live");
  }

  const verifiedHost =
    !!input.listing.profiles?.email_verified && !!input.listing.profiles?.phone_verified;
  if (verifiedHost) {
    score += 10;
  }

  return { score, missing };
}

function buildPhotoCountMap(rows: Array<{ property_id: string | null }>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.property_id) continue;
    map.set(row.property_id, (map.get(row.property_id) ?? 0) + 1);
  }
  return map;
}

export async function getSupplyHealth({
  client,
  rangeDays,
  limit = 300,
}: {
  client: SupabaseClient;
  rangeDays: number;
  limit?: number;
}): Promise<SupplyHealthSummary> {
  const { data, error } = await client
    .from("properties")
    .select(
      "id,title,description,city,location_label,latitude,longitude,status,owner_id,updated_at,expires_at,is_featured,listing_intent,price,currency,created_at,approved_at,profiles!inner(full_name,email_verified,phone_verified)"
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      rows: [],
      generatedAt: new Date().toISOString(),
      rangeDays,
    };
  }

  const listings = (data as SupplyListingRow[]) ?? [];
  const propertyIds = listings.map((row) => row.id);

  const photoCounts = propertyIds.length
    ? await client
        .from("property_images")
        .select("property_id")
        .in("property_id", propertyIds)
    : { data: [] as Array<{ property_id: string | null }> };
  const photoMap = buildPhotoCountMap((photoCounts.data as Array<{ property_id: string | null }>) ?? []);

  const events = propertyIds.length
    ? await fetchPropertyEvents({
        propertyIds,
        sinceDays: rangeDays,
        client,
      })
    : { rows: [] as Awaited<ReturnType<typeof fetchPropertyEvents>>["rows"] };
  const summaryMap = buildSummaryByProperty(events.rows ?? []);

  const rows = listings.map((listing) => {
    const photoCount = photoMap.get(listing.id) ?? 0;
    const { score, missing } = computeQualityScore({ listing, photoCount });
    const summary = summaryMap.get(listing.id);
    const views = summary?.views ?? 0;
    const enquiries = (summary?.enquiries ?? 0) + (summary?.viewingRequests ?? 0);

    return {
      id: listing.id,
      title: listing.title ?? null,
      description: listing.description ?? null,
      city: listing.city ?? null,
      status: listing.status ?? null,
      owner_id: listing.owner_id ?? null,
      owner_name: listing.profiles?.full_name ?? null,
      updated_at: listing.updated_at ?? null,
      expires_at: listing.expires_at ?? null,
      is_featured: listing.is_featured ?? null,
      listing_intent: listing.listing_intent ?? null,
      photo_count: photoCount,
      quality_score: score,
      missing_flags: missing,
      views,
      enquiries,
    } satisfies SupplyHealthRow;
  });

  rows.sort((a, b) => a.quality_score - b.quality_score);

  return {
    rows,
    generatedAt: new Date().toISOString(),
    rangeDays,
  };
}
