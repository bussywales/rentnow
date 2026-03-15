import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin host analytics index has guard, search, and table copy", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "analytics", "host", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("/auth/required?redirect=/admin/analytics/host&reason=auth"),
    "expected auth guard redirect"
  );
  assert.ok(contents.includes("/forbidden?reason=role"), "expected role guard redirect");
  assert.ok(contents.includes("Host analytics"), "expected page title");
  assert.ok(
    contents.includes("<AdminAnalyticsSectionNav current=\"host\" />"),
    "expected sibling analytics nav on host analytics page"
  );
  assert.ok(
    contents.includes("Search hosts… (name or id)"),
    "expected search placeholder"
  );
  assert.ok(contents.includes("Threads"), "expected threads column label");
  assert.ok(contents.includes("Not available"), "expected fallback copy");
  assert.ok(contents.includes("/admin/analytics/host/"), "expected host detail link");
  assert.ok(
    contents.includes("Host quality guidance telemetry"),
    "expected host quality telemetry section title"
  );
  assert.ok(contents.includes("Guidance viewed"), "expected guidance viewed KPI");
  assert.ok(contents.includes("Fix clicks"), "expected fix clicks KPI");
  assert.ok(contents.includes("Improvement rate"), "expected improvement rate KPI");
  assert.ok(contents.includes("Fix clicks by target step"), "expected target-step table");
  assert.ok(
    contents.includes("fetchHostListingQualityTelemetrySnapshot"),
    "expected host quality telemetry loader wiring"
  );
  assert.ok(
    contents.includes("qualityTelemetry.byTargetStep.map"),
    "expected target-step rows to render from telemetry snapshot"
  );
  assert.ok(
    contents.includes('data-testid="admin-host-quality-telemetry"'),
    "expected stable telemetry section test id"
  );
});
