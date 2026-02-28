import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

void test("tenant explore analytics debug route enforces tenant auth and mounts local export panel", () => {
  const sourcePath = path.join(process.cwd(), "app", "tenant", "debug", "explore-analytics", "page.tsx");
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /resolveServerRole/);
  assert.match(source, /role !== "tenant"/);
  assert.match(source, /ExploreAnalyticsPanel/);
});

void test("tenant explore analytics panel includes export and clear controls", () => {
  const sourcePath = path.join(process.cwd(), "components", "tenant", "ExploreAnalyticsPanel.tsx");
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /buildExploreAnalyticsCsv/);
  assert.match(source, /data-testid="tenant-explore-analytics-export"/);
  assert.match(source, /data-testid="tenant-explore-analytics-clear"/);
  assert.match(source, /clearExploreAnalyticsEvents/);
});
