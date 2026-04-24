import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin analytics page includes admin guard and empty state copy", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "analytics", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("/auth/required?redirect=/admin/analytics&reason=auth"),
    "expected auth redirect guard"
  );
  assert.ok(
    contents.includes("/forbidden?reason=role"),
    "expected role guard redirect"
  );
  assert.ok(
    contents.includes("No activity yet"),
    "expected empty state copy for no activity"
  );
  assert.ok(
    contents.includes("Not available"),
    "expected Not available fallback"
  );
  assert.ok(
    contents.includes("Marketplace demand funnel"),
    "expected demand funnel section"
  );
  assert.ok(
    contents.includes('data-testid="admin-analytics-destinations"'),
    "expected analytics destinations section"
  );
  assert.ok(
    contents.includes("data-testid={`admin-analytics-destination-${item.key}`}"),
    "expected analytics destination card test-id contract"
  );
  assert.ok(
    contents.includes("<AdminAnalyticsSectionNav current=\"marketplace\" />"),
    "expected sibling analytics nav on marketplace analytics page"
  );
  assert.ok(
    contents.includes("marketplace, Explore, Explore V2, and host analytics"),
    "expected host analytics in analytics hub helper copy"
  );
  assert.ok(
    contents.includes("Analytics QA and reporting"),
    "expected analytics QA guidance panel heading"
  );
  assert.ok(
    contents.includes('data-testid="admin-analytics-outcome-learning"'),
    "expected compact outcome learning section on admin analytics page"
  );
  assert.ok(
    contents.includes("Commercial discovery"),
    "expected commercial discovery learning copy"
  );
  assert.ok(
    contents.includes("Bootcamp launch"),
    "expected bootcamp launch learning copy"
  );
  assert.ok(
    contents.includes("Support submissions"),
    "expected bootcamp support submission learning copy"
  );
  assert.ok(
    contents.includes("Listing-limit recovery"),
    "expected listing-limit recovery learning copy"
  );
  assert.ok(
    contents.includes("Local living"),
    "expected local living learning copy"
  );
  assert.ok(
    contents.includes("/help/admin/analytics"),
    "expected link to analytics guide from admin analytics page"
  );
  assert.ok(
    contents.includes("/help/admin/analytics/stakeholder-dashboard"),
    "expected link to stakeholder dashboard definitions from admin analytics page"
  );

  const navPath = path.join(process.cwd(), "components", "admin", "AdminAnalyticsSectionNav.tsx");
  const navContents = fs.readFileSync(navPath, "utf8");
  assert.ok(
    navContents.includes('href: "/admin/analytics/explore-v2"'),
    "expected explore v2 destination href in shared analytics nav config"
  );
  assert.ok(
    navContents.includes('href: "/admin/analytics/host"'),
    "expected host analytics destination href in shared analytics nav config"
  );
  assert.ok(
    navContents.includes('label: "Host analytics"'),
    "expected host analytics label in shared analytics nav config"
  );
});
