import test from "node:test";
import assert from "node:assert/strict";
import { calcFees, calcNights, calcSubtotal, formatMoney } from "@/lib/shortlet/pricing";

void test("calcNights handles valid, invalid, and same-day ranges safely", () => {
  assert.equal(calcNights("2026-03-10", "2026-03-13"), 3);
  assert.equal(calcNights("2026-03-10", "2026-03-10"), 0);
  assert.equal(calcNights("2026-03-13", "2026-03-10"), 0);
  assert.equal(calcNights("bad", "2026-03-10"), 0);
  assert.equal(calcNights(null, null), 0);
});

void test("calcSubtotal is deterministic for null and numeric inputs", () => {
  assert.equal(calcSubtotal(3, 45000), 135000);
  assert.equal(calcSubtotal(0, 45000), 0);
  assert.equal(calcSubtotal(3, null), 0);
  assert.equal(calcSubtotal(undefined, undefined), 0);
});

void test("calcFees returns stable breakdown and total", () => {
  const fees = calcFees({
    subtotal: 100000,
    feePolicy: {
      serviceFeePct: 2.5,
      cleaningFee: 6000,
      taxPct: 1,
    },
  });

  assert.deepEqual(fees, {
    serviceFee: 2500,
    cleaningFee: 6000,
    taxes: 1000,
    total: 109500,
  });
});

void test("formatMoney formats currency and falls back safely", () => {
  assert.ok(formatMoney(45000, "NGN").includes("45,000"));
  assert.equal(formatMoney(null, "NGN").includes("0"), true);
  assert.ok(formatMoney(1200.5, "ZZZ").toUpperCase().includes("ZZZ"));
});
