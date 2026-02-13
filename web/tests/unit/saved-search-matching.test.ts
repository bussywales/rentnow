import test from "node:test";
import assert from "node:assert/strict";
import {
  applySavedSearchMatchSpecToQuery,
  buildSavedSearchMatchQuerySpec,
} from "../../lib/saved-searches/matching";

type QueryCall = { op: string; column: string; value: string | number };

function createQueryRecorder() {
  const calls: QueryCall[] = [];
  const query = {
    gt(column: string, value: string) {
      calls.push({ op: "gt", column, value });
      return query;
    },
    ilike(column: string, value: string) {
      calls.push({ op: "ilike", column, value });
      return query;
    },
    eq(column: string, value: string | number | boolean) {
      calls.push({ op: "eq", column, value: String(value) });
      return query;
    },
    gte(column: string, value: number) {
      calls.push({ op: "gte", column, value });
      return query;
    },
    lte(column: string, value: number) {
      calls.push({ op: "lte", column, value });
      return query;
    },
  };
  return { query, calls };
}

void test("builds strict match query for city, exact bedrooms, and price range", () => {
  const spec = buildSavedSearchMatchQuerySpec({
    sinceIso: "2026-02-01T00:00:00.000Z",
    filters: {
      city: "Abuja",
      bedrooms: 2,
      bedroomsMode: "exact",
      minPrice: 500,
      maxPrice: 2500,
    },
  });
  const { query, calls } = createQueryRecorder();
  applySavedSearchMatchSpecToQuery(query, spec);

  assert.deepEqual(calls, [
    { op: "gt", column: "created_at", value: "2026-02-01T00:00:00.000Z" },
    { op: "ilike", column: "city", value: "%Abuja%" },
    { op: "gte", column: "price", value: 500 },
    { op: "lte", column: "price", value: 2500 },
    { op: "eq", column: "bedrooms", value: "2" },
  ]);
});

void test("uses minimum bedroom mode and rental type filters when provided", () => {
  const spec = buildSavedSearchMatchQuerySpec({
    sinceIso: "2026-02-01T00:00:00.000Z",
    filters: {
      bedrooms: 3,
      bedroomsMode: "minimum",
      rentalType: "long_term",
      country_code: "ng",
    },
  });
  const { query, calls } = createQueryRecorder();
  applySavedSearchMatchSpecToQuery(query, spec);

  assert.deepEqual(calls, [
    { op: "gt", column: "created_at", value: "2026-02-01T00:00:00.000Z" },
    { op: "eq", column: "country_code", value: "NG" },
    { op: "gte", column: "bedrooms", value: 3 },
    { op: "eq", column: "rental_type", value: "long_term" },
  ]);
});

void test("applies listing intent filter for rent/buy and skips for all or missing", () => {
  const rentSpec = buildSavedSearchMatchQuerySpec({
    sinceIso: "2026-02-01T00:00:00.000Z",
    filters: {
      intent: "rent",
    },
  });
  const rentRecorder = createQueryRecorder();
  applySavedSearchMatchSpecToQuery(rentRecorder.query, rentSpec);
  assert.deepEqual(rentRecorder.calls, [
    { op: "gt", column: "created_at", value: "2026-02-01T00:00:00.000Z" },
    { op: "eq", column: "listing_intent", value: "rent" },
  ]);

  const buySpec = buildSavedSearchMatchQuerySpec({
    sinceIso: "2026-02-01T00:00:00.000Z",
    filters: {
      listingIntent: "buy",
    },
  });
  const buyRecorder = createQueryRecorder();
  applySavedSearchMatchSpecToQuery(buyRecorder.query, buySpec);
  assert.deepEqual(buyRecorder.calls, [
    { op: "gt", column: "created_at", value: "2026-02-01T00:00:00.000Z" },
    { op: "eq", column: "listing_intent", value: "buy" },
  ]);

  const mixedSpec = buildSavedSearchMatchQuerySpec({
    sinceIso: "2026-02-01T00:00:00.000Z",
    filters: {
      intent: "all",
    },
  });
  const mixedRecorder = createQueryRecorder();
  applySavedSearchMatchSpecToQuery(mixedRecorder.query, mixedSpec);
  assert.deepEqual(mixedRecorder.calls, [
    { op: "gt", column: "created_at", value: "2026-02-01T00:00:00.000Z" },
  ]);
});

void test("ignores unsupported filter keys safely", () => {
  const spec = buildSavedSearchMatchQuerySpec({
    sinceIso: "2026-02-01T00:00:00.000Z",
    filters: {
      unknown: "value",
      anotherOne: 42,
      city: "Lagos",
    },
  });
  const { query, calls } = createQueryRecorder();
  applySavedSearchMatchSpecToQuery(query, spec);

  assert.deepEqual(calls, [
    { op: "gt", column: "created_at", value: "2026-02-01T00:00:00.000Z" },
    { op: "ilike", column: "city", value: "%Lagos%" },
  ]);
});
