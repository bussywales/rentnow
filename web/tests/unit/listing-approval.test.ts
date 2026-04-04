import test from "node:test";
import assert from "node:assert/strict";

import {
  buildListingApprovalGuidance,
  resolveListingApprovalState,
  summarizeListingReviewReason,
} from "../../lib/host/listing-approval";
import type { DashboardListing } from "../../lib/properties/host-dashboard";
import { countByManagerStatus } from "../../lib/host/properties-manager";

function makeListing(
  overrides: Partial<DashboardListing> & Pick<DashboardListing, "id" | "title" | "status">
): DashboardListing {
  return {
    id: overrides.id,
    title: overrides.title,
    status: overrides.status,
    location_label: overrides.location_label ?? "Lekki",
    city: overrides.city ?? "Lagos",
    currency: overrides.currency ?? "GBP",
    price: overrides.price ?? 2500,
    created_at: overrides.created_at ?? "2026-04-04T09:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-04T10:00:00.000Z",
    rejection_reason: overrides.rejection_reason ?? null,
    expires_at: overrides.expires_at ?? null,
    readiness: overrides.readiness ?? { score: 92, tier: "Excellent", issues: [] },
  } as DashboardListing;
}

void test("listing approval state keeps changes requested and rejected distinct", () => {
  assert.equal(resolveListingApprovalState(makeListing({ id: "draft", title: "Draft", status: "draft" })), "draft");
  assert.equal(
    resolveListingApprovalState(makeListing({ id: "changes", title: "Changes", status: "changes_requested" })),
    "changes_requested"
  );
  assert.equal(
    resolveListingApprovalState(makeListing({ id: "reject", title: "Rejected", status: "rejected" })),
    "rejected"
  );
  assert.equal(
    resolveListingApprovalState(
      makeListing({
        id: "expired-live",
        title: "Expired live",
        status: "live",
        expires_at: "2026-04-03T00:00:00.000Z",
      })
    ),
    "paused"
  );
});

void test("listing approval guidance surfaces next actions and stored review reasons", () => {
  const changesRequested = makeListing({
    id: "changes-1",
    title: "Changes requested",
    status: "changes_requested",
    rejection_reason: JSON.stringify({
      type: "admin_review_request_changes",
      reasons: ["needs_photos", "pricing_issue"],
      message: "Please improve the photos and fix the pricing.",
    }),
    readiness: {
      score: 72,
      tier: "Good",
      issues: [{ key: "few_photos", code: "LOW_PHOTO_COUNT", label: "Add more photos.", action: "photos" }],
    },
  });

  const rejected = makeListing({
    id: "rejected-1",
    title: "Rejected",
    status: "rejected",
    rejection_reason: "The address details are too vague for review.",
  });

  const pending = makeListing({ id: "pending-1", title: "Pending", status: "pending" });

  const changesGuidance = buildListingApprovalGuidance(changesRequested);
  assert.equal(changesGuidance.nextActionLabel, "Fix and resubmit");
  assert.match(changesGuidance.reasonSummary || "", /photos/i);

  const rejectedGuidance = buildListingApprovalGuidance(rejected);
  assert.equal(rejectedGuidance.nextActionLabel, "Review feedback");
  assert.match(rejectedGuidance.reasonSummary || "", /address details are too vague/i);

  const pendingGuidance = buildListingApprovalGuidance(pending);
  assert.equal(pendingGuidance.nextActionLabel, "View status");
  assert.match(pendingGuidance.summary, /review team/i);
});

void test("listing approval reason summary falls back to plain text when no structured reasons exist", () => {
  assert.equal(
    summarizeListingReviewReason("Please update the copy and add clearer location details."),
    "Please update the copy and add clearer location details."
  );
});

void test("manager counts reflect review pipeline states separately", () => {
  const counts = countByManagerStatus([
    makeListing({ id: "1", title: "Live", status: "live" }),
    makeListing({ id: "2", title: "Pending", status: "pending" }),
    makeListing({ id: "3", title: "Draft", status: "draft" }),
    makeListing({ id: "4", title: "Changes", status: "changes_requested" }),
    makeListing({ id: "5", title: "Rejected", status: "rejected" }),
    makeListing({ id: "6", title: "Paused", status: "paused_owner" }),
  ]);

  assert.deepEqual(counts, {
    all: 6,
    live: 1,
    pending: 1,
    draft: 1,
    changes_requested: 1,
    rejected: 1,
    paused: 1,
  });
});
