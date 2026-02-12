import test from "node:test";
import assert from "node:assert/strict";
import { buildSavedSearchDigestEmail } from "@/lib/email/templates/saved-search-digest";
import {
  buildSavedSearchAlertDedupeKey,
  getSavedSearchAlertBaselineIso,
  resolveAlertsEmailEnabled,
} from "@/lib/saved-searches/alerts.server";

void test("dedupe key remains stable for the same user/search/day", () => {
  const first = buildSavedSearchAlertDedupeKey({
    userId: "user-1",
    searchId: "search-1",
    dayKey: "2026-02-12",
  });
  const second = buildSavedSearchAlertDedupeKey({
    userId: "user-1",
    searchId: "search-1",
    dayKey: "2026-02-12",
  });
  const nextDay = buildSavedSearchAlertDedupeKey({
    userId: "user-1",
    searchId: "search-1",
    dayKey: "2026-02-13",
  });

  assert.equal(first, second);
  assert.notEqual(first, nextDay);
});

void test("baseline falls back to 7 days when no previous timestamps exist", () => {
  const now = new Date("2026-02-12T10:00:00.000Z");
  const baseline = getSavedSearchAlertBaselineIso({
    now,
    createdAt: null,
    alertLastSentAt: null,
    alertBaselineAt: null,
  });
  assert.equal(baseline, "2026-02-05T10:00:00.000Z");
});

void test("baseline prefers the previous alert sent timestamp when available", () => {
  const now = new Date("2026-02-12T10:00:00.000Z");
  const baseline = getSavedSearchAlertBaselineIso({
    now,
    createdAt: "2026-01-01T00:00:00.000Z",
    alertLastSentAt: "2026-02-10T06:30:00.000Z",
    alertBaselineAt: "2026-02-08T00:00:00.000Z",
  });
  assert.equal(baseline, "2026-02-10T06:30:00.000Z");
});

void test("settings gating disables alerts unless app setting or env override enables it", () => {
  assert.equal(
    resolveAlertsEmailEnabled({
      appSettingValue: { enabled: false },
      envOverride: undefined,
    }),
    false
  );
  assert.equal(
    resolveAlertsEmailEnabled({
      appSettingValue: { enabled: true },
      envOverride: undefined,
    }),
    true
  );
  assert.equal(
    resolveAlertsEmailEnabled({
      appSettingValue: { enabled: false },
      envOverride: "true",
    }),
    true
  );
});

void test("digest email shows overflow hint when search groups are capped", () => {
  const digest = buildSavedSearchDigestEmail({
    siteUrl: "https://www.propatyhub.com",
    groups: [
      {
        savedSearchId: "search-1",
        searchName: "Abuja 2 bed",
        matchCount: 3,
        matchesUrl: "https://www.propatyhub.com/properties?city=Abuja",
        unsubscribeUrl:
          "https://www.propatyhub.com/api/saved-searches/search-1/unsubscribe?token=abc",
        listings: [
          {
            id: "listing-1",
            title: "2 bed apartment",
            city: "Abuja",
            price: 2000000,
            currency: "NGN",
          },
        ],
      },
    ],
    omittedSearchCount: 2,
  });
  assert.equal(digest.subject, "New matches on PropatyHub");
  assert.match(digest.html, /Showing top 1 searches/i);
  assert.match(digest.html, /You have 2 more searches with updates/i);
});
