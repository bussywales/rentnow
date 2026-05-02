import test from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERY_MONITOR_SEED_ITEMS,
  getDeliveryMonitorSeedItem,
} from "@/lib/admin/delivery-monitor-seed";
import {
  getDeliveryMonitorStatusLabel,
  getDeliveryMonitorTestingStatusLabel,
  mergeDeliveryMonitorItems,
  summarizeDeliveryMonitorCounts,
} from "@/lib/admin/delivery-monitor";

void test("delivery monitor seed covers the expected current internal workstreams", () => {
  const keys = DELIVERY_MONITOR_SEED_ITEMS.map((item) => item.key);

  assert.ok(keys.includes("listing_publish_renew_recovery"));
  assert.ok(keys.includes("property_request_subscriber_alerts"));
  assert.ok(keys.includes("property_prep_dispatch_follow_through"));
  assert.ok(keys.includes("bootcamp_launch_system"));
  assert.ok(keys.includes("monitoring_sentry_deep_health"));
  assert.ok(keys.includes("repo_operating_docs"));
  assert.ok(keys.includes("canada_market_segmentation"));
});

void test("delivery monitor merge prefers runtime status override and latest note/test rows", () => {
  const merged = mergeDeliveryMonitorItems({
    statusOverrides: [
      {
        item_key: "bootcamp_launch_system",
        status: "green",
        updated_by: "admin-1",
        created_at: "2026-05-02T08:00:00.000Z",
        updated_at: "2026-05-02T08:00:00.000Z",
      },
    ],
    testRuns: [
      {
        id: "run-1",
        item_key: "bootcamp_launch_system",
        testing_status: "passed",
        tester_name: "Ops QA",
        notes: "Launch CTA and support handoff verified.",
        tested_at: "2026-05-02T09:00:00.000Z",
        created_by: "admin-1",
        created_at: "2026-05-02T09:00:00.000Z",
      },
    ],
    notes: [
      {
        id: "note-1",
        item_key: "bootcamp_launch_system",
        body: "Live traffic still needed.",
        author_name: "Ops QA",
        created_by: "admin-1",
        created_at: "2026-05-02T10:00:00.000Z",
      },
    ],
  });

  const item = merged.find((entry) => entry.key === "bootcamp_launch_system");
  assert.ok(item);
  assert.equal(item?.effectiveStatus, "green");
  assert.equal(item?.testingStatus, "passed");
  assert.equal(item?.latestTestRun?.tester_name, "Ops QA");
  assert.equal(item?.latestNote?.body, "Live traffic still needed.");
  assert.equal(item?.lastUpdatedAt, "2026-05-02T10:00:00.000Z");
});

void test("delivery monitor counts roll up status and testing summaries", () => {
  const counts = summarizeDeliveryMonitorCounts(
    mergeDeliveryMonitorItems({
      testRuns: [
        {
          id: "run-1",
          item_key: "listing_publish_renew_recovery",
          testing_status: "in_progress",
          tester_name: "Billing QA",
          notes: null,
          tested_at: "2026-05-02T09:00:00.000Z",
          created_by: null,
          created_at: "2026-05-02T09:00:00.000Z",
        },
      ],
    })
  );

  assert.equal(counts.total, DELIVERY_MONITOR_SEED_ITEMS.length);
  assert.ok(counts.amber >= 1);
  assert.ok(counts.green >= 1);
  assert.equal(counts.in_progress, 1);
});

void test("delivery monitor labels stay operator-readable", () => {
  assert.equal(getDeliveryMonitorStatusLabel("green"), "Green");
  assert.equal(getDeliveryMonitorTestingStatusLabel("not_started"), "Not started");
  assert.equal(getDeliveryMonitorTestingStatusLabel("in_progress"), "In progress");
  assert.ok(getDeliveryMonitorSeedItem("repo_operating_docs"));
});
