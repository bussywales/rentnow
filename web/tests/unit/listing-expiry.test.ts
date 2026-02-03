import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LISTING_EXPIRY_DAYS,
  buildRenewalUpdate,
  canShowExpiredListingPublic,
  computeExpiryAt,
  isListingPubliclyVisible,
  normalizeListingExpiryDays,
} from "@/lib/properties/expiry";

void test("expiry calculation uses configured days (default 90 fallback)", () => {
  const base = new Date("2024-01-01T00:00:00.000Z");
  const configuredDays = normalizeListingExpiryDays(30, DEFAULT_LISTING_EXPIRY_DAYS);
  const configuredExpiry = computeExpiryAt(base, configuredDays);
  assert.equal(configuredExpiry, "2024-01-31T00:00:00.000Z");

  const fallbackDays = normalizeListingExpiryDays(Number.NaN, DEFAULT_LISTING_EXPIRY_DAYS);
  const fallbackExpiry = computeExpiryAt(base, fallbackDays);
  assert.equal(fallbackExpiry, "2024-03-31T00:00:00.000Z");
});

void test("public listing visibility excludes expired status or past expires_at", () => {
  const now = new Date("2024-01-10T00:00:00.000Z");
  const live = {
    status: "live",
    is_active: true,
    is_approved: true,
    expires_at: "2024-01-20T00:00:00.000Z",
  };
  assert.equal(isListingPubliclyVisible(live, now), true);

  const expiredByDate = {
    ...live,
    expires_at: "2024-01-09T00:00:00.000Z",
  };
  assert.equal(isListingPubliclyVisible(expiredByDate, now), false);

  const expiredStatus = {
    ...live,
    status: "expired",
  };
  assert.equal(isListingPubliclyVisible(expiredStatus, now), false);
});

void test("public listing visibility excludes paused statuses", () => {
  const now = new Date("2024-01-10T00:00:00.000Z");
  const base = {
    status: "paused_owner",
    is_active: true,
    is_approved: true,
    expires_at: "2024-02-10T00:00:00.000Z",
  };
  assert.equal(isListingPubliclyVisible(base, now), false);
  assert.equal(isListingPubliclyVisible({ ...base, status: "paused_occupied" }, now), false);
  assert.equal(isListingPubliclyVisible({ ...base, status: "paused" }, now), false);
});

void test("renewal update sets status live and recalculates expiry", () => {
  const now = new Date("2024-02-01T00:00:00.000Z");
  const update = buildRenewalUpdate({ now, expiryDays: 15 });
  assert.equal(update.status, "live");
  assert.equal(update.is_active, true);
  assert.equal(update.is_approved, true);
  assert.equal(update.renewed_at, "2024-02-01T00:00:00.000Z");
  assert.equal(update.expired_at, null);
  assert.equal(update.expires_at, "2024-02-16T00:00:00.000Z");
});

void test("expired listing visibility respects public toggle", () => {
  const expired = {
    status: "expired",
    is_active: false,
    is_approved: true,
    expires_at: "2024-01-01T00:00:00.000Z",
  };
  assert.equal(canShowExpiredListingPublic(expired, false), false);
  assert.equal(canShowExpiredListingPublic(expired, true), true);
});
