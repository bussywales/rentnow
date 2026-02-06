import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClientSlug,
  normalizeClientPageCriteria,
  serializeClientPageCriteria,
  resolveClientPagePublicState,
} from "@/lib/agents/client-pages";

void test("buildClientSlug ensures uniqueness per agent", () => {
  const slug = buildClientSlug("Acme Homes", ["acme-homes", "acme-homes-2"]);
  assert.equal(slug, "acme-homes-3");
});

void test("criteria serialization roundtrip", () => {
  const criteria = normalizeClientPageCriteria({
    intent: "rent",
    city: "Lagos",
    minPrice: 1000,
    maxPrice: 2500,
    bedrooms: 2,
  });
  const serialized = serializeClientPageCriteria(criteria);
  const parsed = normalizeClientPageCriteria(serialized);
  assert.deepEqual(parsed, criteria);
});

void test("public resolver blocks unpublished and filters non-live", () => {
  const listings = [
    { id: "1", status: "draft" },
    { id: "2", status: "live" },
  ];
  const unpublished = resolveClientPagePublicState({ published: false, listings });
  assert.equal(unpublished.ok, false);
  assert.equal(unpublished.listings.length, 0);

  const published = resolveClientPagePublicState({ published: true, listings });
  assert.equal(published.ok, true);
  assert.equal(published.listings.length, 1);
  assert.equal(published.listings[0].status, "live");
});
