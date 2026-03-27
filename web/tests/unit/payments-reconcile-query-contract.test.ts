import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

void test("payments reconcile receipt queries use explicit is-null filters", () => {
  const source = readFileSync("lib/payments/reconcile.server.ts", "utf8");
  const isNullMatches = source.match(/\.is\("receipt_sent_at", null\)/g) ?? [];

  assert.equal(
    isNullMatches.length,
    2,
    "expected batch and ops receipt queries to use explicit is-null filtering"
  );
  assert.equal(
    source.includes('.not("receipt_sent_at", "is", "not.null")'),
    false,
    "malformed not.null receipt filters should not remain in reconcile queries"
  );
});
