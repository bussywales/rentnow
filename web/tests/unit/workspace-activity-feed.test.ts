import test from "node:test";
import assert from "node:assert/strict";
import {
  getWorkspaceActivityFeed,
  resolveWorkspaceActivityLabel,
  resolveWorkspaceActivityHref,
  type WorkspaceActivityFeedDeps,
  type WorkspaceActivityItem,
} from "@/lib/activity/workspace-activity.server";

function buildItem(input: Partial<WorkspaceActivityItem> & Pick<WorkspaceActivityItem, "id" | "type" | "title" | "createdAt">): WorkspaceActivityItem {
  return {
    label: resolveWorkspaceActivityLabel(input.type),
    href: "/host/listings?view=manage",
    ctaLabel: "Open",
    ...input,
  };
}

void test("workspace activity feed is sorted newest-first, deduped, and capped", async () => {
  const deps: WorkspaceActivityFeedDeps = {
    loadLeadEvents: async () => [
      buildItem({
        id: "dup",
        type: "lead_received",
        title: "Lead",
        createdAt: "2026-02-24T09:00:00.000Z",
        href: "/host/leads",
      }),
      buildItem({
        id: "lead:2",
        type: "lead_received",
        title: "Lead B",
        createdAt: "2026-02-24T12:00:00.000Z",
        href: "/host/leads",
      }),
    ],
    loadBookingEvents: async () => [
      buildItem({
        id: "dup",
        type: "booking_request",
        title: "Booking duplicate id",
        createdAt: "2026-02-24T11:00:00.000Z",
        href: "/host/bookings?view=awaiting_approval",
      }),
    ],
    loadListingApprovalEvents: async () => [
      buildItem({
        id: "listing:1",
        type: "listing_approved",
        title: "Approved",
        createdAt: "2026-02-24T10:00:00.000Z",
      }),
    ],
    loadPayoutEvents: async () => [
      buildItem({
        id: "payout:bad",
        type: "payout_paid",
        title: "Bad date",
        createdAt: "invalid-date",
        href: "/host/earnings",
      }),
      buildItem({
        id: "payout:1",
        type: "payout_paid",
        title: "Paid",
        createdAt: "2026-02-24T08:00:00.000Z",
        href: "/host/earnings",
      }),
    ],
    loadSupportEscalationEvents: async () => [
      buildItem({
        id: "support:1",
        type: "support_escalated",
        title: "Support",
        createdAt: "2026-02-24T07:00:00.000Z",
        href: "/support",
      }),
    ],
    loadNotificationEvents: async () => [],
  };

  const items = await getWorkspaceActivityFeed(
    {
      client: {} as never,
      userId: "user-1",
      role: "landlord",
      limit: 3,
    },
    deps
  );

  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((item) => item.id),
    ["lead:2", "listing:1", "dup"]
  );
  assert.ok(items.every((item) => typeof item.href === "string" && item.href.startsWith("/")));
});

void test("workspace activity href mappings stay aligned with workspace routes", () => {
  assert.equal(resolveWorkspaceActivityHref("lead_received"), "/host/leads");
  assert.equal(
    resolveWorkspaceActivityHref("booking_request", "booking-1"),
    "/host/bookings?view=awaiting_approval&booking=booking-1"
  );
  assert.equal(resolveWorkspaceActivityHref("listing_approved"), "/host/listings?view=manage");
  assert.equal(resolveWorkspaceActivityHref("payout_requested"), "/host/earnings");
  assert.equal(resolveWorkspaceActivityHref("payout_paid"), "/host/earnings");
  assert.equal(resolveWorkspaceActivityHref("support_escalated"), "/support");
});

void test("workspace activity labels expose stable v2 copy", () => {
  assert.equal(resolveWorkspaceActivityLabel("lead_received"), "Lead received");
  assert.equal(resolveWorkspaceActivityLabel("booking_request"), "Booking request");
  assert.equal(resolveWorkspaceActivityLabel("listing_approved"), "Listing approved");
  assert.equal(resolveWorkspaceActivityLabel("payout_requested"), "Payout requested");
  assert.equal(resolveWorkspaceActivityLabel("support_escalated"), "Support escalation");
});
