import test from "node:test";
import assert from "node:assert/strict";
import { buildSavedSuggestions } from "@/lib/saved";

void test("saved suggestions are market-aware and deterministic for a fixed date", () => {
  const fixedNow = new Date("2026-02-26T12:00:00.000Z");
  const first = buildSavedSuggestions({
    marketCountry: "CA",
    now: fixedNow,
    limitPerSection: 3,
  });
  const second = buildSavedSuggestions({
    marketCountry: "CA",
    now: fixedNow,
    limitPerSection: 3,
  });

  assert.ok(first.shortlets.length >= 1);
  assert.ok(first.shortlets.length <= 3);
  assert.ok(first.properties.length >= 1);
  assert.ok(first.properties.length <= 3);
  assert.deepEqual(
    first.shortlets.map((item) => item.id),
    second.shortlets.map((item) => item.id)
  );
  assert.deepEqual(
    first.properties.map((item) => item.id),
    second.properties.map((item) => item.id)
  );
  assert.ok(
    first.shortlets.every((item) => item.id.startsWith("ca-") || item.id.startsWith("global-"))
  );
  assert.ok(
    first.properties.every((item) => item.id.startsWith("ca-") || item.id.startsWith("global-"))
  );
});

void test("saved suggestions fall back to global catalogue for unknown market", () => {
  const suggestions = buildSavedSuggestions({
    marketCountry: "ZZ",
    now: new Date("2026-02-26T12:00:00.000Z"),
    limitPerSection: 2,
  });

  assert.ok(suggestions.shortlets.every((item) => item.id.startsWith("global-")));
  assert.ok(suggestions.properties.every((item) => item.id.startsWith("global-")));
});
