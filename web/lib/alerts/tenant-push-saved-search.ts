import { parseFiltersFromSavedSearch, propertyMatchesFilters } from "@/lib/search-filters";
import type { PushDeliveryOutcome } from "@/lib/push/outcomes";
import type { PushDeliveryInsert } from "@/lib/admin/push-delivery-telemetry";
import type { Property, SavedSearch } from "@/lib/types";

export const SAVED_SEARCH_PUSH_REASON = "saved_search_match";

export type SavedSearchRecipient = {
  tenantId: string;
  subscriptionIds: string[];
};

export function shouldAttemptSavedSearchPush(input: {
  pushReady: boolean;
  subscriptionCount: number;
  deduped: boolean;
}): boolean {
  if (!input.pushReady) return false;
  if (input.subscriptionCount <= 0) return false;
  return !input.deduped;
}

export function matchPropertyToSavedSearch(
  property: Property,
  savedSearch: SavedSearch
): boolean {
  const filters = parseFiltersFromSavedSearch(savedSearch.query_params || {});
  return propertyMatchesFilters(property, filters);
}

export function computeRecipients(input: {
  property: Property;
  savedSearches: SavedSearch[];
  subscriptionIdsByUser?: Map<string, string[]>;
}): SavedSearchRecipient[] {
  const recipients = new Map<string, SavedSearchRecipient>();
  input.savedSearches.forEach((search) => {
    if (!matchPropertyToSavedSearch(input.property, search)) return;
    const tenantId = search.user_id;
    if (!recipients.has(tenantId)) {
      recipients.set(tenantId, {
        tenantId,
        subscriptionIds: input.subscriptionIdsByUser?.get(tenantId) ?? [],
      });
    }
  });
  return Array.from(recipients.values());
}

export function buildSavedSearchPushPayload(input: {
  property: Property;
  siteUrl: string;
}): Record<string, unknown> {
  const city = input.property.city || "your area";
  return {
    type: "saved_search_match",
    property_id: input.property.id,
    title: "New listing match",
    body: `${input.property.title} in ${city}.`,
    city,
    url: `${input.siteUrl}/properties/${input.property.id}`,
  };
}

function parsePushReason(error: string | null | undefined) {
  if (!error) return null;
  const trimmed = error.split("|")[0]?.trim() ?? "";
  if (trimmed.startsWith("push_unavailable:")) {
    return trimmed.replace("push_unavailable:", "");
  }
  if (trimmed.startsWith("push_failed:")) {
    return trimmed.replace("push_failed:", "");
  }
  if (trimmed.startsWith("push_pruned:")) {
    return trimmed.replace("push_pruned:", "");
  }
  return trimmed;
}

export function buildTenantPushDeliveryAttempt(input: {
  outcome: PushDeliveryOutcome;
  propertyId: string;
  subscriptionCount: number;
}): PushDeliveryInsert {
  const rawReason = parsePushReason(input.outcome.error);
  const reason =
    rawReason === "not_configured"
      ? "push_not_configured"
      : rawReason === "missing_subscription"
        ? "no_subscriptions"
        : rawReason ?? SAVED_SEARCH_PUSH_REASON;

  let status: PushDeliveryInsert["status"] = "skipped";
  if (input.outcome.status === "sent") {
    status = "delivered";
  } else if (input.outcome.status === "failed") {
    status = "failed";
  } else if (reason === "push_not_configured") {
    status = "blocked";
  }

  return {
    actorUserId: null,
    kind: "tenant_saved_search",
    status,
    reasonCode: reason,
    deliveredCount: input.outcome.deliveredCount ?? 0,
    failedCount: input.outcome.failedCount ?? 0,
    skippedCount: status === "skipped" ? 1 : 0,
    blockedCount: status === "blocked" ? 1 : 0,
    meta: {
      propertyId: input.propertyId,
      subscriptionCount: input.subscriptionCount,
    },
  };
}
