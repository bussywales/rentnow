import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveAnalyticsHostId, resolveAnalyticsRange } from "@/lib/analytics/landlord-analytics";

void test("dashboard analytics page guards non-listing roles", () => {
  const pagePath = path.join(process.cwd(), "app", "dashboard", "analytics", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("Analytics are available to landlords and agents"),
    "expected role-gated copy"
  );
  assert.ok(
    contents.includes("canManageListings"),
    "expected role gating to use canManageListings"
  );
});

void test("admin host analytics page enforces admin guard", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "analytics", "host", "[id]", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("/forbidden?reason=role"),
    "expected admin role guard"
  );
  assert.ok(
    contents.includes("/auth/required?redirect=/admin/analytics/host"),
    "expected auth redirect with next"
  );
});

void test("host analytics panel includes Not available fallback", () => {
  const panelPath = path.join(process.cwd(), "components", "analytics", "HostAnalyticsPanel.tsx");
  const contents = fs.readFileSync(panelPath, "utf8");

  assert.ok(
    contents.includes("Not available"),
    "expected Not available fallback copy"
  );
});

void test("resolveAnalyticsHostId uses actingAs only when allowed", () => {
  const result = resolveAnalyticsHostId({
    userId: "host-a",
    role: "agent",
    actingAs: "host-b",
    canActAs: true,
  });

  assert.equal(result.hostId, "host-b");
  assert.equal(result.actingAsUsed, true);

  const fallback = resolveAnalyticsHostId({
    userId: "host-a",
    role: "agent",
    actingAs: "host-b",
    canActAs: false,
  });

  assert.equal(fallback.hostId, "host-a");
  assert.equal(fallback.actingAsUsed, false);
});

void test("resolveAnalyticsRange uses previous period offsets", () => {
  const now = new Date("2026-01-11T12:00:00Z");
  const range = resolveAnalyticsRange("last7", now);

  assert.equal(range.key, "last7");
  assert.ok(new Date(range.previousEnd).getTime() === new Date(range.start).getTime());
});
