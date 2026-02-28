import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EXPLORE_ANALYTICS_SETTINGS,
  parseExploreAnalyticsSettingsRows,
} from "@/lib/explore/explore-analytics-settings";

void test("explore analytics settings parser falls back to defaults when rows are missing", () => {
  const parsed = parseExploreAnalyticsSettingsRows([]);
  assert.deepEqual(parsed, DEFAULT_EXPLORE_ANALYTICS_SETTINGS);
});

void test("explore analytics settings parser reads boolean flags from app_settings rows", () => {
  const parsed = parseExploreAnalyticsSettingsRows([
    { key: "explore_analytics_enabled", value: { enabled: false } },
    { key: "explore_analytics_consent_required", value: { enabled: true } },
    { key: "explore_analytics_notice_enabled", value: { enabled: false } },
  ]);

  assert.equal(parsed.enabled, false);
  assert.equal(parsed.consentRequired, true);
  assert.equal(parsed.noticeEnabled, false);
});
