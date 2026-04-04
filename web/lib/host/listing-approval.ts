import { buildFixRequestItems, parseRejectionReason } from "@/lib/admin/host-fix-request";
import type { DashboardListing } from "@/lib/properties/host-dashboard";
import { buildEditorUrl } from "@/lib/properties/host-dashboard";
import { isListingExpired } from "@/lib/properties/expiry";
import { mapStatusLabel, normalizePropertyStatus } from "@/lib/properties/status";

export type ListingApprovalState =
  | "live"
  | "pending"
  | "draft"
  | "changes_requested"
  | "rejected"
  | "paused";

export type ListingApprovalGuidance = {
  state: ListingApprovalState;
  statusLabel: string;
  summary: string;
  reasonSummary: string | null;
  nextActionLabel: string;
  nextActionHref: string;
};

function normalizeReviewMessage(message: string | null) {
  const compact = String(message || "").replace(/\s+/g, " ").trim();
  return compact || null;
}

export function resolveListingApprovalState(listing: DashboardListing): ListingApprovalState {
  const normalized = normalizePropertyStatus(listing.status ?? null);

  if (normalized === "live" && isListingExpired(listing)) return "paused";
  if (normalized === "pending") return "pending";
  if (normalized === "changes_requested") return "changes_requested";
  if (normalized === "rejected") return "rejected";
  if (normalized === "draft") return "draft";

  if (
    normalized === "paused" ||
    normalized === "paused_owner" ||
    normalized === "paused_occupied" ||
    normalized === "expired" ||
    normalized === "removed"
  ) {
    return "paused";
  }

  return "live";
}

export function summarizeListingReviewReason(raw: unknown): string | null {
  const parsed = parseRejectionReason(raw);
  const reasonLabels =
    parsed.reasons.length > 0
      ? buildFixRequestItems(parsed.reasons)
          .map((item) => item.label.trim())
          .filter(Boolean)
      : [];

  if (reasonLabels.length > 0) {
    return reasonLabels.slice(0, 2).join(" ");
  }

  return normalizeReviewMessage(parsed.message);
}

function buildPausedSummary(listing: DashboardListing) {
  const normalized = normalizePropertyStatus(listing.status ?? null);

  if (normalized === "removed") {
    return "This listing was removed by admin. Review the notes and update it before trying again.";
  }
  if (normalized === "paused_occupied") {
    return "This listing is paused while the property is occupied. Review it before making it available again.";
  }
  if (normalized === "expired" || (normalized === "live" && isListingExpired(listing))) {
    return "This listing is no longer live because its visibility expired. Review it before relaunching.";
  }

  return "This listing is not currently live. Review it before putting it back into approval or visibility.";
}

export function buildListingApprovalGuidance(listing: DashboardListing): ListingApprovalGuidance {
  const state = resolveListingApprovalState(listing);
  const topIssue = listing.readiness.issues[0]?.code;
  const baseEditHref = `/host/properties/${listing.id}/edit`;
  const reviewReason = summarizeListingReviewReason(listing.rejection_reason);

  switch (state) {
    case "draft":
      return {
        state,
        statusLabel: mapStatusLabel("draft"),
        summary: "Finish the required listing details, then submit it for approval.",
        reasonSummary: null,
        nextActionLabel: "Finish setup",
        nextActionHref: buildEditorUrl(listing.id, topIssue),
      };
    case "pending":
      return {
        state,
        statusLabel: mapStatusLabel("pending"),
        summary: "This listing is with the review team. No action is needed unless feedback comes back.",
        reasonSummary: null,
        nextActionLabel: "View status",
        nextActionHref: baseEditHref,
      };
    case "changes_requested":
      return {
        state,
        statusLabel: mapStatusLabel("changes_requested"),
        summary: "Review the requested fixes, update the listing, and resubmit for approval.",
        reasonSummary: reviewReason,
        nextActionLabel: "Fix and resubmit",
        nextActionHref: buildEditorUrl(listing.id, topIssue),
      };
    case "rejected":
      return {
        state,
        statusLabel: mapStatusLabel("rejected"),
        summary: "This listing was not approved. Review the feedback before submitting it again.",
        reasonSummary: reviewReason,
        nextActionLabel: "Review feedback",
        nextActionHref: baseEditHref,
      };
    case "paused":
      return {
        state,
        statusLabel: mapStatusLabel(normalizePropertyStatus(listing.status ?? null) || "paused"),
        summary: buildPausedSummary(listing),
        reasonSummary: null,
        nextActionLabel: "Review listing",
        nextActionHref: baseEditHref,
      };
    default:
      return {
        state: "live",
        statusLabel: mapStatusLabel("live"),
        summary: "This listing is live in the marketplace. Keep its details current and monitor performance.",
        reasonSummary: null,
        nextActionLabel: "Open live listing",
        nextActionHref: `/properties/${listing.id}`,
      };
  }
}
