import type { SupabaseClient } from "@supabase/supabase-js";

export type ListingRemovalDependencyCount = {
  key: string;
  label: string;
  count: number;
};

export type ListingRemovalDependencySummary = {
  protected: ListingRemovalDependencyCount[];
  cleanup: ListingRemovalDependencyCount[];
  protectedCount: number;
  cleanupCount: number;
  errors: string[];
  canPurge: boolean;
};

type DependencyDefinition = {
  key: string;
  label: string;
  table: string;
  column: string;
  group: "protected" | "cleanup";
};

const DEPENDENCIES: DependencyDefinition[] = [
  {
    key: "shortlet_bookings",
    label: "Shortlet bookings",
    table: "shortlet_bookings",
    column: "property_id",
    group: "protected",
  },
  {
    key: "shortlet_payments",
    label: "Shortlet payments",
    table: "shortlet_payments",
    column: "property_id",
    group: "protected",
  },
  {
    key: "message_threads",
    label: "Message threads",
    table: "message_threads",
    column: "property_id",
    group: "protected",
  },
  {
    key: "listing_leads",
    label: "Listing leads",
    table: "listing_leads",
    column: "property_id",
    group: "protected",
  },
  {
    key: "viewing_requests",
    label: "Viewing requests",
    table: "viewing_requests",
    column: "property_id",
    group: "protected",
  },
  {
    key: "agent_commission_agreements",
    label: "Commission agreements",
    table: "agent_commission_agreements",
    column: "listing_id",
    group: "protected",
  },
  {
    key: "featured_purchases",
    label: "Canonical featured purchases",
    table: "featured_purchases",
    column: "property_id",
    group: "protected",
  },
  {
    key: "feature_purchases",
    label: "Legacy featured purchases",
    table: "feature_purchases",
    column: "listing_id",
    group: "protected",
  },
  {
    key: "featured_credit_consumptions",
    label: "Featured credit consumptions",
    table: "featured_credit_consumptions",
    column: "listing_id",
    group: "protected",
  },
  {
    key: "listing_payments",
    label: "Listing payments",
    table: "listing_payments",
    column: "listing_id",
    group: "protected",
  },
  {
    key: "property_request_response_items",
    label: "Property request matches sent",
    table: "property_request_response_items",
    column: "listing_id",
    group: "protected",
  },
  {
    key: "property_images",
    label: "Listing images",
    table: "property_images",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "property_videos",
    label: "Listing videos",
    table: "property_videos",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "shortlet_settings",
    label: "Shortlet settings",
    table: "shortlet_settings",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "property_share_links",
    label: "Property share links",
    table: "property_share_links",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "saved_properties",
    label: "Saved favourites",
    table: "saved_properties",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "saved_collection_items",
    label: "Saved collection items",
    table: "saved_collection_items",
    column: "listing_id",
    group: "cleanup",
  },
  {
    key: "property_events",
    label: "Analytics events",
    table: "property_events",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "property_checkins",
    label: "Check-in telemetry",
    table: "property_checkins",
    column: "property_id",
    group: "cleanup",
  },
];

async function countDependencyRows(
  client: SupabaseClient,
  dependency: DependencyDefinition,
  listingId: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const result = await client
    .from(dependency.table)
    .select("*", { count: "exact", head: true })
    .eq(dependency.column, listingId);

  if (result.error) {
    return {
      ok: false,
      error: `${dependency.label}: ${result.error.message}`,
    };
  }

  return { ok: true, count: result.count ?? 0 };
}

export async function getListingRemovalDependencySummary({
  client,
  listingId,
}: {
  client: SupabaseClient;
  listingId: string;
}): Promise<ListingRemovalDependencySummary> {
  const protectedRows: ListingRemovalDependencyCount[] = [];
  const cleanupRows: ListingRemovalDependencyCount[] = [];
  const errors: string[] = [];

  const results = await Promise.all(
    DEPENDENCIES.map(async (dependency) => ({
      dependency,
      result: await countDependencyRows(client, dependency, listingId),
    }))
  );

  for (const { dependency, result } of results) {
    const target = dependency.group === "protected" ? protectedRows : cleanupRows;
    if (!result.ok) {
      errors.push(result.error);
      target.push({ key: dependency.key, label: dependency.label, count: 0 });
      continue;
    }
    target.push({ key: dependency.key, label: dependency.label, count: result.count });
  }

  const protectedCount = protectedRows.reduce((sum, row) => sum + row.count, 0);
  const cleanupCount = cleanupRows.reduce((sum, row) => sum + row.count, 0);

  return {
    protected: protectedRows,
    cleanup: cleanupRows,
    protectedCount,
    cleanupCount,
    errors,
    canPurge: errors.length === 0 && protectedCount === 0,
  };
}
