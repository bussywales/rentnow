import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

void test("billing page resolves market-aware subscription pricing on the server", () => {
  const source = read("app/dashboard/billing/page.tsx");

  assert.match(source, /loadSubscriptionPriceBookRows/);
  assert.match(source, /resolveMarketFromRequest/);
  assert.match(source, /resolveSubscriptionPlanQuote/);
  assert.match(source, /pricingByPlanKey/);
  assert.match(source, /marketCurrency=\{market\.currency\}/);
});

void test("plans grid no longer hardcodes GBP subscription labels", () => {
  const gridSource = read("components/billing/PlansGrid.tsx");
  const cardSource = read("components/billing/PlanCard.tsx");

  assert.doesNotMatch(gridSource, /£29 \/ month|£49 \/ month|£9 \/ month|£290 \/ year|£490 \/ year|£90 \/ year/);
  assert.doesNotMatch(cardSource, /£0/);
  assert.match(gridSource, /pricingByPlanKey/);
  assert.match(cardSource, /pricing\?\.provider/);
});

void test("stripe checkout route resolves market-aware subscription pricing before session creation", () => {
  const source = read("app/api/billing/stripe/checkout/route.ts");

  assert.match(source, /loadSubscriptionPriceBookRows/);
  assert.match(source, /resolveMarketFromRequest/);
  assert.match(source, /resolveSubscriptionPlanQuote/);
  assert.match(source, /subscription_market_currency/);
});
