import { test } from "node:test";
import assert from "node:assert/strict";
import { applyStayFilterToQuery, buildSearchLocationIlikeClause } from "@/lib/search";

test("applyStayFilterToQuery adds shortlet-only clause when stay=shortlet", () => {
  let capturedClause: string | null = null;
  const query = {
    or: (clause: string) => {
      capturedClause = clause;
      return query;
    },
  };

  applyStayFilterToQuery(query, { listingIntent: "rent", stay: "shortlet" });
  assert.equal(capturedClause, "listing_intent.eq.shortlet,rental_type.eq.short_let");
});

test("applyStayFilterToQuery is a no-op when stay filter is absent", () => {
  let called = false;
  const query = {
    or: (clause: string) => {
      void clause;
      called = true;
      return query;
    },
  };

  applyStayFilterToQuery(query, { listingIntent: "rent", stay: null });
  assert.equal(called, false);
});

test("applyStayFilterToQuery is a no-op for sale intent", () => {
  let called = false;
  const query = {
    or: (clause: string) => {
      void clause;
      called = true;
      return query;
    },
  };

  applyStayFilterToQuery(query, { listingIntent: "buy", stay: "shortlet" });
  assert.equal(called, false);
});

test("buildSearchLocationIlikeClause returns null for empty search", () => {
  assert.equal(buildSearchLocationIlikeClause("   "), null);
});

test("buildSearchLocationIlikeClause builds multi-field ilike clause", () => {
  const clause = buildSearchLocationIlikeClause("Lekki, Lagos");
  assert.ok(clause);
  assert.match(clause as string, /city\.ilike\.\%Lekki Lagos\%/);
  assert.match(clause as string, /country\.ilike\.\%Lekki Lagos\%/);
  assert.match(clause as string, /country_code\.ilike\.\%Lekki Lagos\%/);
});
