import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildHostListingAnalyticsPreferenceKeys,
  getHostListingAnalyticsPanelModel,
  parseHostListingAnalyticsCollapsed,
  parseHostListingAnalyticsMode,
} from "@/lib/host/listing-analytics-preferences";

void test("host listing analytics preference keys are persisted per host", () => {
  const keys = buildHostListingAnalyticsPreferenceKeys("host-42");
  assert.equal(keys.modeKey, "home:host:listing-analytics:mode:v1:host-42");
  assert.equal(keys.collapsedKey, "home:host:listing-analytics:collapsed:v1:host-42");

  const anonKeys = buildHostListingAnalyticsPreferenceKeys();
  assert.equal(anonKeys.modeKey, "home:host:listing-analytics:mode:v1:anon");
  assert.equal(anonKeys.collapsedKey, "home:host:listing-analytics:collapsed:v1:anon");
});

void test("analytics mode parser falls back safely and collapsed parser handles storage values", () => {
  assert.equal(parseHostListingAnalyticsMode("expanded"), "expanded");
  assert.equal(parseHostListingAnalyticsMode("compact"), "compact");
  assert.equal(parseHostListingAnalyticsMode("invalid"), "compact");
  assert.equal(parseHostListingAnalyticsCollapsed("1"), true);
  assert.equal(parseHostListingAnalyticsCollapsed("0"), false);
  assert.equal(parseHostListingAnalyticsCollapsed(null), false);
});

void test("compact analytics model renders fewer rows and tighter spacing than expanded", () => {
  const compact = getHostListingAnalyticsPanelModel("compact");
  const expanded = getHostListingAnalyticsPanelModel("expanded");

  assert.ok(compact.rowCount < expanded.rowCount, "compact should render fewer analytics rows");
  assert.match(compact.containerClassName, /py-1\.5/);
  assert.match(expanded.containerClassName, /py-2\.5/);
});

void test("host dashboard wires listing analytics compact and collapse controls", () => {
  const filePath = path.join(process.cwd(), "components", "host", "HostDashboardContent.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /host-home-listing-analytics-controls/);
  assert.match(source, /Show analytics/);
  assert.match(source, /Hide analytics/);
  assert.match(source, /Compact/);
  assert.match(source, /Expanded/);
  assert.match(source, /buildHostListingAnalyticsPreferenceKeys/);
  assert.match(source, /parseHostListingAnalyticsMode/);
  assert.match(source, /parseHostListingAnalyticsCollapsed/);
});
