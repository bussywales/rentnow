import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRow = {
  id: string;
  full_name: string | null;
  business_name: string | null;
};

type RawListing = {
  id: string;
  title: string | null;
  owner_id: string | null;
  status: string | null;
  is_approved: boolean | null;
  is_active: boolean | null;
  city: string | null;
  country: string | null;
  country_code: string | null;
  listing_type: string | null;
  size_value: number | null;
  size_unit: string | null;
  deposit_amount: number | null;
  deposit_currency: string | null;
  created_at: string | null;
  updated_at: string | null;
  property_images?: Array<{ id: string }> | null;
};

export type AffectedListing = {
  id: string;
  title: string | null;
  ownerId: string | null;
  ownerLabel: string;
  statusLabel: string;
  missingReasons: string[];
  missingLabels: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type AffectedListingsSnapshot = {
  listings: AffectedListing[];
  missingPhotosAvailable: boolean;
  error: string | null;
};

const MISSING_REASON_LABELS: Record<string, string> = {
  country_code: "country code",
  listing_type: "listing type",
  city: "city",
  country: "country",
  size_unit: "size unit",
  size_value: "size value",
  deposit_currency: "deposit currency",
  deposit_amount: "deposit amount",
  photos: "photos",
};

const normalizeText = (value: string | null | undefined) => (value ?? "").trim();

const hasText = (value: string | null | undefined) => normalizeText(value).length > 0;

export function formatOwnerLabel(ownerId: string | null | undefined, profile?: ProfileRow | null) {
  if (profile?.full_name) return profile.full_name;
  if (profile?.business_name) return profile.business_name;
  if (!ownerId) return "Unknown";
  return `${ownerId.slice(0, 8)}...`;
}

export function deriveMissingReasons(row: RawListing, missingPhotosAvailable: boolean) {
  const reasons: string[] = [];

  if (hasText(row.country) && !hasText(row.country_code)) {
    reasons.push("country_code");
  }
  if (!hasText(row.country)) {
    reasons.push("country");
  }
  if (!hasText(row.city)) {
    reasons.push("city");
  }
  if (!hasText(row.listing_type)) {
    reasons.push("listing_type");
  }

  const hasSizeValue = row.size_value !== null && row.size_value !== undefined;
  const hasSizeUnit = hasText(row.size_unit);
  if (hasSizeValue && !hasSizeUnit) {
    reasons.push("size_unit");
  }
  if (!hasSizeValue && hasSizeUnit) {
    reasons.push("size_value");
  }

  const hasDepositAmount = row.deposit_amount !== null && row.deposit_amount !== undefined;
  const hasDepositCurrency = hasText(row.deposit_currency);
  if (hasDepositAmount && !hasDepositCurrency) {
    reasons.push("deposit_currency");
  }
  if (!hasDepositAmount && hasDepositCurrency) {
    reasons.push("deposit_amount");
  }

  if (
    missingPhotosAvailable &&
    Array.isArray(row.property_images) &&
    row.property_images.length === 0
  ) {
    reasons.push("photos");
  }

  return reasons;
}

export function formatMissingLabels(reasons: string[]) {
  return reasons.map((reason) => MISSING_REASON_LABELS[reason] ?? reason);
}

function resolveStatusLabel(row: RawListing) {
  if (row.status) return row.status;
  if (row.is_active === false) return "inactive";
  if (row.is_approved === false) return "pending";
  if (row.is_approved === true) return "approved";
  return "unknown";
}

export async function buildAffectedListings(
  adminClient: SupabaseClient,
  limit = 30
): Promise<AffectedListingsSnapshot> {
  const errors: string[] = [];
  const baseSelect =
    "id, title, owner_id, status, is_approved, is_active, city, country, country_code, listing_type, size_value, size_unit, deposit_amount, deposit_currency, created_at, updated_at";
  let missingPhotosAvailable = true;

  const listingsResult = await adminClient
    .from("properties")
    // Missing photos derived from public.property_images relation.
    .select(`${baseSelect}, property_images(id)`)
    .order("created_at", { ascending: false })
    .limit(200);
  let rows: RawListing[] | null = listingsResult.data as RawListing[] | null;
  const listingsError = listingsResult.error;

  if (listingsError) {
    errors.push(`affectedListings: ${listingsError.message}`);
    missingPhotosAvailable = false;
    const fallback = await adminClient
      .from("properties")
      .select(baseSelect)
      .order("created_at", { ascending: false })
      .limit(200);
    rows = fallback.data as RawListing[] | null;
    if (fallback.error) {
      errors.push(`affectedListingsFallback: ${fallback.error.message}`);
      return {
        listings: [],
        missingPhotosAvailable,
        error: errors.join(" | "),
      };
    }
  }

  const candidates = (rows as RawListing[] | null) ?? [];
  const affected = candidates
    .map((row) => {
      const missingReasons = deriveMissingReasons(row, missingPhotosAvailable);
      return {
        row,
        missingReasons,
      };
    })
    .filter((entry) => entry.missingReasons.length > 0)
    .slice(0, limit);

  const ownerIds = Array.from(
    new Set(affected.map(({ row }) => row.owner_id).filter(Boolean) as string[])
  );

  const { data: profiles, error: profilesError } = ownerIds.length
    ? await adminClient
        .from("profiles")
        .select("id, full_name, business_name")
        .in("id", ownerIds)
    : { data: [] as ProfileRow[], error: null };

  if (profilesError) {
    errors.push(`affectedListingsProfiles: ${profilesError.message}`);
  }

  const profileMap = new Map(
    ((profiles as ProfileRow[] | null) ?? []).map((profile) => [
      profile.id,
      profile,
    ])
  );

  const listings: AffectedListing[] = affected.map(({ row, missingReasons }) => {
    const profile = row.owner_id ? profileMap.get(row.owner_id) ?? null : null;
    return {
      id: row.id,
      title: row.title,
      ownerId: row.owner_id,
      ownerLabel: formatOwnerLabel(row.owner_id, profile),
      statusLabel: resolveStatusLabel(row),
      missingReasons,
      missingLabels: formatMissingLabels(missingReasons),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    };
  });

  return {
    listings,
    missingPhotosAvailable,
    error: errors.length ? errors.join(" | ") : null,
  };
}
