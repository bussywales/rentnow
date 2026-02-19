import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SHORTLET_CANCELLATION_POLICY,
  formatShortletCancellationLabel,
  isFreeCancellationPolicy,
  normalizeShortletCancellationPolicy,
  resolveShortletCancellationPolicy,
} from "@/lib/shortlet/cancellation";

void test("cancellation policy normalization accepts known values only", () => {
  assert.equal(normalizeShortletCancellationPolicy("flexible_24h"), "flexible_24h");
  assert.equal(normalizeShortletCancellationPolicy("flexible_48h"), "flexible_48h");
  assert.equal(normalizeShortletCancellationPolicy("moderate_5d"), "moderate_5d");
  assert.equal(normalizeShortletCancellationPolicy("strict"), "strict");
  assert.equal(normalizeShortletCancellationPolicy("unknown"), null);
});

void test("cancellation policy resolver defaults to flexible_48h", () => {
  assert.equal(DEFAULT_SHORTLET_CANCELLATION_POLICY, "flexible_48h");
  assert.equal(resolveShortletCancellationPolicy({ shortlet_settings: null }), "flexible_48h");
  assert.equal(
    resolveShortletCancellationPolicy({
      shortlet_settings: [{ cancellation_policy: "strict" }],
    }),
    "strict"
  );
});

void test("free cancellation policy helper excludes strict", () => {
  assert.equal(isFreeCancellationPolicy("flexible_24h"), true);
  assert.equal(isFreeCancellationPolicy("flexible_48h"), true);
  assert.equal(isFreeCancellationPolicy("moderate_5d"), true);
  assert.equal(isFreeCancellationPolicy("strict"), false);
  assert.equal(isFreeCancellationPolicy(null), false);
});

void test("cancellation label formatter returns stable copy for each policy", () => {
  assert.equal(
    formatShortletCancellationLabel("flexible_24h"),
    "Free cancellation until 24 hours before check-in"
  );
  assert.equal(
    formatShortletCancellationLabel("flexible_48h"),
    "Free cancellation until 48 hours before check-in"
  );
  assert.equal(
    formatShortletCancellationLabel("moderate_5d"),
    "Free cancellation until 5 days before check-in"
  );
  assert.equal(formatShortletCancellationLabel("strict"), "Cancellation policy: Strict");
});
