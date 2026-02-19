import test from "node:test";
import assert from "node:assert/strict";
import { getPlaceSuggestions } from "@/lib/places/suggest";

void test("places suggest boosts nigeria in NG market but keeps global matches", () => {
  const suggestions = getPlaceSuggestions({
    q: "la",
    market: "NG",
    limit: 20,
  });

  assert.ok(suggestions.length > 0);
  assert.equal(suggestions[0]?.countryCode, "NG");
  assert.ok(
    suggestions.some(
      (item) => item.countryCode && item.countryCode !== "NG"
    )
  );
});

void test("places suggest applies limits and prefix ranking", () => {
  const suggestions = getPlaceSuggestions({
    q: "ab",
    market: "NG",
    limit: 3,
  });

  assert.equal(suggestions.length <= 3, true);
  assert.equal(suggestions[0]?.label.toLowerCase().startsWith("ab"), true);
});

void test("empty query returns no suggestions", () => {
  assert.deepEqual(
    getPlaceSuggestions({
      q: "",
      market: "NG",
      limit: 8,
    }),
    []
  );
});
