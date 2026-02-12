import { isFeaturedListingActive } from "@/lib/properties/featured";
import { isListingPubliclyVisible, type ListingVisibilityInput } from "@/lib/properties/expiry";

export type FeaturedRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type FeaturedRequestDuration = 7 | 30 | null;
export type FeaturedRequestAction = "approve" | "reject";
export type FeaturedRequestHostState =
  | "featured_active"
  | "pending_review"
  | "rejected"
  | "approved_awaiting_activation"
  | "cancelled"
  | "none";

export type FeaturedRequestHostSummary = {
  state: FeaturedRequestHostState;
  label: string | null;
  showDecisionNote: boolean;
};

export function parseFeaturedRequestDuration(input: unknown): FeaturedRequestDuration {
  if (input === null || typeof input === "undefined") return null;
  const raw = Number(input);
  if (!Number.isFinite(raw)) return null;
  if (Math.trunc(raw) === 7) return 7;
  if (Math.trunc(raw) === 30) return 30;
  return null;
}

export function resolveFeaturedUntil(durationDays: FeaturedRequestDuration, now: Date = new Date()): string | null {
  if (durationDays === null) return null;
  return new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

export function isListingEligibleForFeaturedRequest(
  listing: ListingVisibilityInput & {
    is_demo?: boolean | null;
    is_featured?: boolean | null;
    featured_until?: string | null;
  },
  now: Date = new Date()
): boolean {
  if (listing.is_demo) return false;
  if (!isListingPubliclyVisible(listing, now)) return false;
  if (isFeaturedListingActive({ is_featured: listing.is_featured, featured_until: listing.featured_until }, now)) {
    return false;
  }
  return true;
}

export function durationLabel(durationDays: FeaturedRequestDuration): string {
  if (durationDays === 7) return "7 days";
  if (durationDays === 30) return "30 days";
  return "No expiry";
}

export function validateFeaturedRequestTransition(input: {
  currentStatus: FeaturedRequestStatus;
  action: FeaturedRequestAction;
}): { ok: true } | { ok: false; status: 409; reason: string } {
  if (input.currentStatus !== "pending") {
    return { ok: false, status: 409, reason: "Only pending requests can be approved or rejected." };
  }
  if (input.action !== "approve" && input.action !== "reject") {
    return { ok: false, status: 409, reason: "Invalid action." };
  }
  return { ok: true };
}

export function isFeaturedRequestStale(
  createdAt: string | null | undefined,
  now: Date = new Date(),
  staleDays = 14
): boolean {
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  return now.getTime() - createdMs >= staleDays * 24 * 60 * 60 * 1000;
}

export function resolveFeaturedRequestHostSummary(input: {
  isFeaturedActive: boolean;
  hasFeaturedUntil: boolean;
  requestStatus?: FeaturedRequestStatus | null;
}): FeaturedRequestHostSummary {
  if (input.isFeaturedActive) {
    return {
      state: "featured_active",
      label: input.hasFeaturedUntil ? "Featured until" : "Featured",
      showDecisionNote: false,
    };
  }

  if (input.requestStatus === "pending") {
    return {
      state: "pending_review",
      label: "Featured request: Pending review",
      showDecisionNote: false,
    };
  }

  if (input.requestStatus === "rejected") {
    return {
      state: "rejected",
      label: "Featured request: Rejected",
      showDecisionNote: true,
    };
  }

  if (input.requestStatus === "approved") {
    return {
      state: "approved_awaiting_activation",
      label: "Approved (awaiting activation)",
      showDecisionNote: false,
    };
  }

  if (input.requestStatus === "cancelled") {
    return {
      state: "cancelled",
      label: "Request cancelled",
      showDecisionNote: false,
    };
  }

  return {
    state: "none",
    label: null,
    showDecisionNote: false,
  };
}
