import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCollectionResultsHref,
  getCollectionCards,
} from "@/lib/collections/collections-select";

void test("weekend-getaways collection routes to shortlets results", () => {
  const href = buildCollectionResultsHref({
    slug: "weekend-getaways",
    marketCountry: "CA",
    now: new Date("2026-02-25T00:00:00.000Z"),
  });
  assert.ok(href);
  assert.match(href!, /^\/shortlets(\?|$)/);
});

void test("verified-homes-for-sale collection routes to properties buy results", () => {
  const href = buildCollectionResultsHref({
    slug: "verified-homes-for-sale",
    marketCountry: "GB",
    now: new Date("2026-02-25T00:00:00.000Z"),
  });
  assert.ok(href);
  assert.match(href!, /^\/properties\?/);
  assert.match(href!, /intent=buy/);
});

void test("collection card selection is market-safe and deterministic", () => {
  const first = getCollectionCards({
    slug: "weekend-getaways",
    marketCountry: "CA",
    now: new Date("2026-02-25T00:00:00.000Z"),
    limit: 4,
  });
  const repeat = getCollectionCards({
    slug: "weekend-getaways",
    marketCountry: "CA",
    now: new Date("2026-02-25T00:00:00.000Z"),
    limit: 4,
  });
  const nextDay = getCollectionCards({
    slug: "weekend-getaways",
    marketCountry: "CA",
    now: new Date("2026-02-26T00:00:00.000Z"),
    limit: 4,
  });

  assert.ok(first.length > 0);
  assert.ok(first.length <= 4);
  assert.deepEqual(
    first.map((item) => item.id),
    repeat.map((item) => item.id)
  );
  assert.ok(nextDay.length > 0);
  assert.ok(nextDay.length <= 4);
  assert.equal(new Set(first.map((item) => item.id)).size, first.length);
  assert.equal(first.some((item) => item.id.startsWith("ng-")), false);
  assert.equal(nextDay.some((item) => item.id.startsWith("ng-")), false);
  assert.ok(first.every((item) => Array.isArray(item.badges)));
});

void test("unknown collection returns empty cards and null href", () => {
  assert.deepEqual(
    getCollectionCards({
      slug: "not-real",
      marketCountry: "US",
    }),
    []
  );
  assert.equal(
    buildCollectionResultsHref({
      slug: "not-real",
      marketCountry: "US",
    }),
    null
  );
});
