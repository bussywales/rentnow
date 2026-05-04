import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin delivery monitor page stays admin-only and mounts the seeded board", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "delivery-monitor", "page.tsx"),
    "utf8"
  );

  assert.match(source, /redirect\("\/auth\/required\?redirect=\/admin\/delivery-monitor/);
  assert.match(source, /profile\?\.role !== "admin"/);
  assert.match(source, /Delivery Monitor/);
  assert.match(source, /Seeded from repo-truth workstreams/i);
  assert.match(source, /AdminDeliveryMonitorClient/);
  assert.match(source, /data-testid="admin-delivery-monitor-page"/);
});

void test("delivery monitor client exposes list rows, drawer detail, and testing controls", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "components", "admin", "AdminDeliveryMonitorClient.tsx"),
    "utf8"
  );

  assert.match(source, /data-testid="delivery-monitor-list"/);
  assert.match(source, /setSelectedItemKey\(item\.key\)/);
  assert.match(source, /data-testid="delivery-monitor-drawer"/);
  assert.match(source, /data-testid="delivery-monitor-drawer-content"/);
  assert.match(source, /Delivered/);
  assert.match(source, /Outstanding/);
  assert.match(source, /Testing guide/);
  assert.match(source, /data-testid="delivery-monitor-testing-guide"/);
  assert.match(source, /data-testid="delivery-monitor-notes-log"/);
  assert.match(source, /data-testid="delivery-monitor-test-runs-log"/);
  assert.match(source, /data-testid="delivery-monitor-status-select"/);
  assert.match(source, /data-testid="delivery-monitor-testing-status-select"/);
  assert.match(source, /data-testid="delivery-monitor-note-input"/);
  assert.doesNotMatch(source, /toLocaleString\(/);
  assert.match(source, /toISOString\(\)/);
  assert.match(source, /drawerOpen \? "translate-x-0" : "translate-x-full"/);
  assert.match(source, /cn\(/);
});

void test("delivery monitor seed includes the core stakeholder closure items", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib", "admin", "delivery-monitor-seed.ts"),
    "utf8"
  );

  assert.match(source, /listing_publish_renew_recovery/);
  assert.match(source, /property_request_title_integrity/);
  assert.match(source, /property_request_taxonomy_non_room_logic/);
  assert.match(source, /property_request_submission_trust/);
  assert.match(source, /market_pricing_control_plane/);
  assert.match(source, /property_request_subscriber_alerts/);
  assert.match(source, /role_account_state_hardening/);
  assert.match(source, /property_prep_model_b_foundation/);
  assert.match(source, /property_prep_dispatch_follow_through/);
  assert.match(source, /canada_market_segmentation/);
  assert.match(source, /bootcamp_launch_system/);
  assert.match(source, /monitoring_sentry_deep_health/);
  assert.match(source, /repo_operating_docs/);
});

void test("admin overview and sidebar expose delivery monitor navigation", () => {
  const adminOverview = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "page.tsx"),
    "utf8"
  );
  const sidebarSource = fs.readFileSync(
    path.join(process.cwd(), "lib", "workspace", "sidebar-model.ts"),
    "utf8"
  );

  assert.match(adminOverview, /href="\/admin\/delivery-monitor"/);
  assert.match(adminOverview, /Delivery monitor/);
  assert.match(sidebarSource, /label: "Delivery monitor"/);
  assert.match(sidebarSource, /href: "\/admin\/delivery-monitor"/);
});
