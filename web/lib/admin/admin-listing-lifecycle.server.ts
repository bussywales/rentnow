import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingRemovalDependencySummary } from "@/lib/admin/listing-removal.server";

export type AdminListingLifecycleRow = {
  id: string;
  title: string | null;
  status: string | null;
  is_active: boolean | null;
  is_approved: boolean | null;
  is_featured: boolean | null;
};

export type AdminBulkListingAction = "deactivate" | "purge";

export type AdminBulkListingEligibility =
  | "eligible"
  | "already_removed"
  | "requires_removed_status"
  | "protected_history"
  | "dependency_audit_failed"
  | "not_found";

export type AdminBulkListingPreflightItem = {
  id: string;
  title: string | null;
  status: string | null;
  eligibility: AdminBulkListingEligibility;
  reason: string;
  dependencySummary: ListingRemovalDependencySummary | null;
};

export type AdminBulkListingPreflightSummary = {
  action: AdminBulkListingAction;
  selectedCount: number;
  foundCount: number;
  eligibleCount: number;
  blockedCount: number;
  alreadyRemovedCount: number;
  recommendedDeactivateCount: number;
  missingCount: number;
  requiredConfirmationText: string | null;
  items: AdminBulkListingPreflightItem[];
};

export const SINGLE_LISTING_PURGE_CONFIRMATION = "DELETE";

export function formatBulkPurgeConfirmation(count: number) {
  return `DELETE ${count} LISTINGS`;
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase();
}

function describeProtectedHistory(summary: ListingRemovalDependencySummary) {
  const protectedRows = summary.protected.filter((row) => row.count > 0);
  if (!protectedRows.length) {
    return "Protected history exists.";
  }
  const labels = protectedRows
    .slice(0, 3)
    .map((row) => `${row.label} (${row.count})`)
    .join(", ");
  return `Protected history blocks permanent delete: ${labels}.`;
}

export function buildAdminBulkListingPreflight({
  action,
  selectedIds,
  listings,
  dependencySummaryById,
}: {
  action: AdminBulkListingAction;
  selectedIds: string[];
  listings: AdminListingLifecycleRow[];
  dependencySummaryById: Record<string, ListingRemovalDependencySummary>;
}): AdminBulkListingPreflightSummary {
  const listingsById = new Map(listings.map((listing) => [listing.id, listing]));
  let eligibleCount = 0;
  let blockedCount = 0;
  let alreadyRemovedCount = 0;
  let recommendedDeactivateCount = 0;
  let missingCount = 0;

  const items = selectedIds.map<AdminBulkListingPreflightItem>((id) => {
    const listing = listingsById.get(id) ?? null;
    if (!listing) {
      blockedCount += 1;
      missingCount += 1;
      return {
        id,
        title: null,
        status: null,
        eligibility: "not_found",
        reason: "Listing not found or no longer accessible.",
        dependencySummary: null,
      };
    }

    const status = normalizeStatus(listing.status);
    const dependencySummary = dependencySummaryById[id] ?? null;

    if (action === "deactivate") {
      if (status === "removed") {
        blockedCount += 1;
        alreadyRemovedCount += 1;
        return {
          id,
          title: listing.title ?? null,
          status: listing.status ?? null,
          eligibility: "already_removed",
          reason: "Listing is already removed from the marketplace.",
          dependencySummary,
        };
      }
      eligibleCount += 1;
      return {
        id,
        title: listing.title ?? null,
        status: listing.status ?? null,
        eligibility: "eligible",
        reason: "Eligible for bulk deactivate.",
        dependencySummary,
      };
    }

    if (status !== "removed") {
      blockedCount += 1;
      recommendedDeactivateCount += 1;
      return {
        id,
        title: listing.title ?? null,
        status: listing.status ?? null,
        eligibility: "requires_removed_status",
        reason: "Deactivate this listing first before permanent delete.",
        dependencySummary,
      };
    }

    if (!dependencySummary || dependencySummary.errors.length > 0) {
      blockedCount += 1;
      return {
        id,
        title: listing.title ?? null,
        status: listing.status ?? null,
        eligibility: "dependency_audit_failed",
        reason: "Dependency audit failed. Resolve audit errors before permanent delete.",
        dependencySummary,
      };
    }

    if (!dependencySummary.canPurge || dependencySummary.protectedCount > 0) {
      blockedCount += 1;
      return {
        id,
        title: listing.title ?? null,
        status: listing.status ?? null,
        eligibility: "protected_history",
        reason: describeProtectedHistory(dependencySummary),
        dependencySummary,
      };
    }

    eligibleCount += 1;
    return {
      id,
      title: listing.title ?? null,
      status: listing.status ?? null,
      eligibility: "eligible",
      reason: "Eligible for permanent delete.",
      dependencySummary,
    };
  });

  return {
    action,
    selectedCount: selectedIds.length,
    foundCount: listings.length,
    eligibleCount,
    blockedCount,
    alreadyRemovedCount,
    recommendedDeactivateCount,
    missingCount,
    requiredConfirmationText:
      action === "purge" && eligibleCount > 0 ? formatBulkPurgeConfirmation(eligibleCount) : null,
    items,
  };
}

export async function deactivateListingForAdmin({
  client,
  listing,
  actorId,
  reason,
  dependencySummary,
}: {
  client: SupabaseClient;
  listing: AdminListingLifecycleRow;
  actorId: string;
  reason: string;
  dependencySummary: ListingRemovalDependencySummary;
}) {
  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: "removed",
    is_active: false,
    is_approved: false,
    is_featured: false,
    featured_rank: null,
    featured_until: null,
    rejection_reason: null,
    paused_reason: null,
    paused_at: null,
    status_updated_at: nowIso,
    updated_at: nowIso,
  };

  const { error: updateError } = await client.from("properties").update(updates).eq("id", listing.id);
  if (updateError) {
    throw new Error(updateError.message || "Unable to deactivate listing.");
  }

  const revokeResult = await client
    .from("property_share_links")
    .update({ revoked_at: nowIso })
    .eq("property_id", listing.id)
    .is("revoked_at", null)
    .select("id");

  if (revokeResult.error) {
    throw new Error(revokeResult.error.message || "Unable to revoke property share links.");
  }

  try {
    await client.from("admin_actions_log").insert({
      property_id: listing.id,
      action_type: "remove_marketplace",
      actor_id: actorId,
      payload_json: {
        reason,
        prior_status: listing.status,
        share_links_revoked: revokeResult.data?.length ?? 0,
        protected_dependency_count: dependencySummary.protectedCount,
      },
    });
  } catch {
    // ignore audit insert failure
  }

  return {
    id: listing.id,
    shareLinksRevoked: revokeResult.data?.length ?? 0,
  };
}

export async function purgeListingForAdmin({
  client,
  listing,
  actorId,
  reason,
  dependencySummary,
}: {
  client: SupabaseClient;
  listing: AdminListingLifecycleRow;
  actorId: string;
  reason: string;
  dependencySummary: ListingRemovalDependencySummary;
}) {
  const { error: deleteError } = await client.from("properties").delete().eq("id", listing.id);
  if (deleteError) {
    throw new Error(deleteError.message || "Unable to permanently delete listing.");
  }

  try {
    await client.from("admin_actions_log").insert({
      property_id: null,
      action_type: "purge_listing",
      actor_id: actorId,
      payload_json: {
        reason,
        purged_property_id: listing.id,
        prior_status: listing.status,
        title: listing.title ?? null,
        protected_dependency_count: dependencySummary.protectedCount,
        cleanup_dependency_count: dependencySummary.cleanupCount,
      },
    });
  } catch {
    // ignore audit insert failure
  }

  return { id: listing.id };
}
