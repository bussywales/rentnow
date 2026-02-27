import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSavedSearchPushPolicy,
  isDailyPushCapReached,
  isWithinQuietHours,
  normalizeTenantNotificationPrefs,
  resolveDefaultNotificationTimezone,
} from "../../lib/notifications/settings";

void test("notification prefs default timezone is market-aware", () => {
  assert.equal(resolveDefaultNotificationTimezone("NG"), "Africa/Lagos");
  assert.equal(resolveDefaultNotificationTimezone("GB"), "Europe/London");
  assert.equal(resolveDefaultNotificationTimezone("US"), "America/New_York");
  assert.equal(resolveDefaultNotificationTimezone("CA"), "America/Toronto");
  assert.equal(resolveDefaultNotificationTimezone(null), "Europe/London");
});

void test("normalizeTenantNotificationPrefs falls back to safe defaults", () => {
  const prefs = normalizeTenantNotificationPrefs({
    profileId: "tenant-1",
    countryCode: "US",
    row: null,
  });

  assert.equal(prefs.savedSearchPushEnabled, true);
  assert.equal(prefs.savedSearchPushMode, "instant");
  assert.equal(prefs.quietHoursStart, null);
  assert.equal(prefs.quietHoursEnd, null);
  assert.equal(prefs.timezone, "America/New_York");
});

void test("quiet-hours window supports overnight ranges", () => {
  assert.equal(
    isWithinQuietHours({
      now: new Date("2026-02-27T22:30:00.000Z"),
      timezone: "Europe/London",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    }),
    true
  );

  assert.equal(
    isWithinQuietHours({
      now: new Date("2026-02-27T12:00:00.000Z"),
      timezone: "Europe/London",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    }),
    false
  );
});

void test("quiet-hours window supports same-day ranges", () => {
  assert.equal(
    isWithinQuietHours({
      now: new Date("2026-02-27T22:30:00.000Z"),
      timezone: "Europe/London",
      quietHoursStart: "22:00",
      quietHoursEnd: "23:00",
    }),
    true
  );

  assert.equal(
    isWithinQuietHours({
      now: new Date("2026-02-27T23:30:00.000Z"),
      timezone: "Europe/London",
      quietHoursStart: "22:00",
      quietHoursEnd: "23:00",
    }),
    false
  );
});

void test("daily cap is scoped to local calendar day", () => {
  assert.equal(
    isDailyPushCapReached({
      now: new Date("2026-02-27T18:00:00.000Z"),
      timezone: "Europe/London",
      lastSavedSearchPushAt: "2026-02-27T01:00:00.000Z",
    }),
    true
  );

  assert.equal(
    isDailyPushCapReached({
      now: new Date("2026-02-27T18:00:00.000Z"),
      timezone: "Europe/London",
      lastSavedSearchPushAt: "2026-02-26T23:30:00.000Z",
    }),
    false
  );
});

void test("push policy blocks disabled, quiet-hours, and capped daily sends", () => {
  const base = normalizeTenantNotificationPrefs({
    profileId: "tenant-1",
    countryCode: "GB",
    row: {
      profile_id: "tenant-1",
      saved_search_push_enabled: true,
      saved_search_push_mode: "instant",
      timezone: "Europe/London",
    },
  });

  const disabled = evaluateSavedSearchPushPolicy({
    prefs: { ...base, savedSearchPushEnabled: false },
    now: new Date("2026-02-27T10:00:00.000Z"),
  });
  assert.deepEqual(disabled, { allow: false, reason: "prefs_disabled" });

  const quiet = evaluateSavedSearchPushPolicy({
    prefs: {
      ...base,
      quietHoursStart: "09:00",
      quietHoursEnd: "11:00",
    },
    now: new Date("2026-02-27T10:00:00.000Z"),
  });
  assert.deepEqual(quiet, { allow: false, reason: "quiet_hours" });

  const daily = evaluateSavedSearchPushPolicy({
    prefs: {
      ...base,
      savedSearchPushMode: "daily",
      lastSavedSearchPushAt: "2026-02-27T08:30:00.000Z",
    },
    now: new Date("2026-02-27T10:00:00.000Z"),
  });
  assert.deepEqual(daily, { allow: false, reason: "daily_cap" });
});
