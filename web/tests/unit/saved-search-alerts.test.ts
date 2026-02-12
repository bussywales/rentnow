import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSavedSearchAlertDedupeKey,
  createSavedSearchUnsubscribeToken,
  isSavedSearchAlertDue,
  isValidSavedSearchUnsubscribeToken,
} from "../../lib/saved-searches/alerts.server";

void test("instant alerts are rate-limited to at most once per 6 hours", () => {
  const now = new Date("2026-02-12T12:00:00.000Z");
  assert.equal(
    isSavedSearchAlertDue({
      frequency: "instant",
      lastSentAt: "2026-02-12T07:30:00.000Z",
      now,
    }),
    false
  );
  assert.equal(
    isSavedSearchAlertDue({
      frequency: "instant",
      lastSentAt: "2026-02-12T06:00:00.000Z",
      now,
    }),
    true
  );
});

void test("daily and weekly alert cadence is enforced", () => {
  const now = new Date("2026-02-12T12:00:00.000Z");
  assert.equal(
    isSavedSearchAlertDue({
      frequency: "daily",
      lastSentAt: "2026-02-12T01:00:00.000Z",
      now,
    }),
    false
  );
  assert.equal(
    isSavedSearchAlertDue({
      frequency: "daily",
      lastSentAt: "2026-02-11T11:59:00.000Z",
      now,
    }),
    true
  );
  assert.equal(
    isSavedSearchAlertDue({
      frequency: "weekly",
      lastSentAt: "2026-02-07T12:01:00.000Z",
      now,
    }),
    false
  );
  assert.equal(
    isSavedSearchAlertDue({
      frequency: "weekly",
      lastSentAt: "2026-02-05T12:00:00.000Z",
      now,
    }),
    true
  );
});

void test("dedupe key is stable for the same search + listing set", () => {
  const a = buildSavedSearchAlertDedupeKey({
    userId: "user-1",
    searchId: "search-1",
    dayKey: "2026-02-12",
  });
  const b = buildSavedSearchAlertDedupeKey({
    userId: "user-1",
    searchId: "search-1",
    dayKey: "2026-02-12",
  });
  const c = buildSavedSearchAlertDedupeKey({
    userId: "user-1",
    searchId: "search-1",
    dayKey: "2026-02-13",
  });

  assert.equal(a, b);
  assert.notEqual(a, c);
});

void test("unsubscribe token validates only for the matching search/user pair", () => {
  const previous = process.env.JOB_SECRET;
  process.env.JOB_SECRET = "test-secret";

  try {
    const token = createSavedSearchUnsubscribeToken({
      searchId: "search-1",
      userId: "user-1",
    });
    assert.ok(token.length > 10);
    assert.equal(
      isValidSavedSearchUnsubscribeToken({
        searchId: "search-1",
        userId: "user-1",
        token,
      }),
      true
    );
    assert.equal(
      isValidSavedSearchUnsubscribeToken({
        searchId: "search-2",
        userId: "user-1",
        token,
      }),
      false
    );
  } finally {
    if (previous) process.env.JOB_SECRET = previous;
    else delete process.env.JOB_SECRET;
  }
});
