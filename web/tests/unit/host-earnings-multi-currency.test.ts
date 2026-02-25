import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMultiCurrencyTotal,
  groupMoneyByCurrency,
  sortCurrencyMinorTotals,
} from "@/lib/money/multi-currency";

void test("groupMoneyByCurrency aggregates single-currency totals", () => {
  const totals = groupMoneyByCurrency(
    [
      { currency: "NGN", amount: 125_000_00 },
      { currency: "NGN", amount: 25_000_00 },
    ],
    (row) => row.amount
  );

  assert.deepEqual(totals, { NGN: 150_000_00 });
});

void test("groupMoneyByCurrency aggregates multiple currencies and normalizes codes", () => {
  const totals = groupMoneyByCurrency(
    [
      { currency: "ngn", amount: 100_000_00 },
      { currency: "GBP", amount: 130 },
      { currency: "NGN", amount: 2_000_00 },
    ],
    (row) => row.amount
  );

  assert.deepEqual(totals, {
    GBP: 130,
    NGN: 102_000_00,
  });
});

void test("groupMoneyByCurrency drops zero and non-positive values", () => {
  const totals = groupMoneyByCurrency(
    [
      { currency: "NGN", amount: 0 },
      { currency: "GBP", amount: -300 },
      { currency: "USD", amount: Number.NaN },
    ],
    (row) => row.amount
  );

  assert.deepEqual(totals, {});
});

void test("sortCurrencyMinorTotals keeps deterministic ordering with optional preferred currency", () => {
  const totals = {
    USD: 200_00,
    GBP: 100_00,
    NGN: 500_00,
  };

  const defaultOrder = sortCurrencyMinorTotals(totals);
  const preferredOrder = sortCurrencyMinorTotals(totals, { preferredCurrency: "NGN" });

  assert.deepEqual(defaultOrder.map((entry) => entry[0]), ["GBP", "NGN", "USD"]);
  assert.deepEqual(preferredOrder.map((entry) => entry[0]), ["NGN", "GBP", "USD"]);
});

void test("formatMultiCurrencyTotal renders grouped string with deterministic order", () => {
  const formatted = formatMultiCurrencyTotal(
    {
      NGN: 1_002_000_00,
      GBP: 130,
    },
    { preferredCurrency: "NGN" }
  );

  assert.match(formatted, /^₦/);
  assert.match(formatted, / \+ /);
  assert.match(formatted, /£1\.30/);
});
