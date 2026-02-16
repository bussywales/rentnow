import { test } from "node:test";
import assert from "node:assert/strict";
import { applyStayFilterToQuery } from "@/lib/search";

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
