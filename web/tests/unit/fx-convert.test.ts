import test from "node:test";
import assert from "node:assert/strict";
import { convertMinor, createFxSnapshot, sumToCurrencyMinor } from "@/lib/fx/fx";

const snapshot = createFxSnapshot({
  date: "2026-02-25",
  baseCurrency: "USD",
  rates: {
    NGN: 1500,
    GBP: 0.8,
    CAD: 1.35,
    USD: 1,
  },
  source: "test",
});

void test("createFxSnapshot normalizes codes and keeps positive rates", () => {
  const normalized = createFxSnapshot({
    date: "2026-02-25",
    baseCurrency: "usd",
    rates: {
      ngn: 1500,
      GBP: 0.8,
      BAD: -1,
    },
    source: "fixture",
  });

  assert.ok(normalized);
  assert.equal(normalized?.baseCurrency, "USD");
  assert.equal(normalized?.rates.NGN, 1500);
  assert.equal(normalized?.rates.GBP, 0.8);
  assert.equal(Object.hasOwn(normalized?.rates ?? {}, "BAD"), false);
});

void test("convertMinor returns same value for same-currency conversion", () => {
  assert.ok(snapshot);
  const converted = convertMinor({
    amountMinor: 12_345,
    from: "NGN",
    to: "NGN",
    snapshot: snapshot as NonNullable<typeof snapshot>,
  });
  assert.equal(converted, 12_345);
});

void test("convertMinor converts across currencies using base currency rates", () => {
  assert.ok(snapshot);
  const converted = convertMinor({
    amountMinor: 130,
    from: "GBP",
    to: "NGN",
    snapshot: snapshot as NonNullable<typeof snapshot>,
  });

  assert.equal(converted, 243_750);
});

void test("convertMinor returns null when a required rate is missing", () => {
  const tinySnapshot = createFxSnapshot({
    date: "2026-02-25",
    baseCurrency: "USD",
    rates: { NGN: 1550 },
    source: "fixture",
  });
  assert.ok(tinySnapshot);

  const converted = convertMinor({
    amountMinor: 100_00,
    from: "GBP",
    to: "NGN",
    snapshot: tinySnapshot as NonNullable<typeof tinySnapshot>,
  });

  assert.equal(converted, null);
});

void test("sumToCurrencyMinor aggregates converted rows deterministically", () => {
  assert.ok(snapshot);
  const total = sumToCurrencyMinor({
    rows: [
      { amountMinor: 100_00, currency: "GBP" },
      { amountMinor: 10_000_00, currency: "NGN" },
    ],
    to: "CAD",
    snapshot: snapshot as NonNullable<typeof snapshot>,
  });

  assert.equal(total, 17_775);
});

void test("sumToCurrencyMinor returns null when any row cannot be converted", () => {
  assert.ok(snapshot);
  const total = sumToCurrencyMinor({
    rows: [
      { amountMinor: 100_00, currency: "GBP" },
      { amountMinor: 200_00, currency: "EUR" },
    ],
    to: "NGN",
    snapshot: snapshot as NonNullable<typeof snapshot>,
  });

  assert.equal(total, null);
});
