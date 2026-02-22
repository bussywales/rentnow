import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePropertyDetailWithFallback,
  shouldAttemptPropertyDetailFallback,
  type PropertyDetailFetchResult,
} from "@/lib/properties/property-detail-resilience";

void test("shouldAttemptPropertyDetailFallback allows API/site-url mismatch failures", () => {
  assert.equal(shouldAttemptPropertyDetailFallback("API responded with 404"), true);
  assert.equal(shouldAttemptPropertyDetailFallback("TypeError: failed to fetch"), true);
  assert.equal(shouldAttemptPropertyDetailFallback("Invalid property id"), false);
});

void test("resolvePropertyDetailWithFallback uses db fallback when primary fetch fails", async () => {
  let fallbackCalls = 0;
  const primary: PropertyDetailFetchResult = {
    property: null,
    error: "API responded with 404",
    apiUrl: "https://wrong-host.example.com/api/properties/p-1",
  };

  const resolved = await resolvePropertyDetailWithFallback({
    primary: async () => primary,
    fallback: async () => {
      fallbackCalls += 1;
      return {
        id: "p-1",
        title: "Fallback listing",
      } as never;
    },
  });

  assert.equal(fallbackCalls, 1);
  assert.equal(resolved.usedFallback, true);
  assert.equal(resolved.error, null);
  assert.equal(resolved.property?.id, "p-1");
});

void test("resolvePropertyDetailWithFallback does not fallback for invalid id errors", async () => {
  let fallbackCalls = 0;
  const resolved = await resolvePropertyDetailWithFallback({
    primary: async () => ({
      property: null,
      error: "Invalid property id",
      apiUrl: null,
    }),
    fallback: async () => {
      fallbackCalls += 1;
      return null;
    },
  });

  assert.equal(fallbackCalls, 0);
  assert.equal(resolved.usedFallback, false);
  assert.equal(resolved.error, "Invalid property id");
});
