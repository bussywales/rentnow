import test from "node:test";
import assert from "node:assert/strict";

import { CURRENCY_CODES, TOP_CURRENCIES, normalizeCurrency } from "../../lib/currencies";

void test("normalizeCurrency uppercases known codes", () => {
  assert.equal(normalizeCurrency("ngn"), "NGN");
  assert.equal(normalizeCurrency("usd"), "USD");
});

void test("normalizeCurrency rejects unknown codes", () => {
  assert.equal(normalizeCurrency("zzz"), null);
});

void test("currency list includes pinned and core options", () => {
  TOP_CURRENCIES.forEach((code) => {
    assert.ok(CURRENCY_CODES.includes(code), `missing ${code}`);
  });
  assert.ok(CURRENCY_CODES.includes("EUR"), "expected EUR in list");
  assert.ok(CURRENCY_CODES.length > 100, "expected full currency list");
});
