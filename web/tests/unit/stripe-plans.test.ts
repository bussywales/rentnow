import test from "node:test";
import assert from "node:assert/strict";

import {
  getStripePlanByPriceId,
  getStripePriceId,
  listStripePlans,
  resolveStripePriceSelection,
} from "../../lib/billing/stripe-plans";

process.env.STRIPE_PRICE_LANDLORD_MONTHLY = "price_landlord_monthly";
process.env.STRIPE_PRICE_LANDLORD_YEARLY = "price_landlord_yearly";
process.env.STRIPE_PRICE_LANDLORD_MONTHLY_TEST = "price_landlord_monthly_test";
process.env.STRIPE_PRICE_AGENT_MONTHLY = "price_agent_monthly";
process.env.STRIPE_PRICE_AGENT_YEARLY = "price_agent_yearly";
process.env.STRIPE_PRICE_AGENT_YEARLY_LIVE = "price_agent_yearly_live";
process.env.STRIPE_PRICE_TENANT_TENANT_PRO_MONTHLY_NGN_LIVE = "price_tenant_monthly_ngn_live";
process.env.STRIPE_PRICE_TENANT_MONTHLY_GBP = "price_tenant_monthly_gbp";

void test("stripe plan mapping resolves price ids", () => {
  const landlordMonthly = getStripePriceId({
    role: "landlord",
    tier: "starter",
    cadence: "monthly",
  });
  assert.equal(landlordMonthly, "price_landlord_monthly");

  const landlordMonthlyTest = getStripePriceId({
    role: "landlord",
    tier: "starter",
    cadence: "monthly",
    mode: "test",
  });
  assert.equal(landlordMonthlyTest, "price_landlord_monthly_test");

  const agentYearly = getStripePriceId({
    role: "agent",
    tier: "pro",
    cadence: "yearly",
  });
  assert.equal(agentYearly, "price_agent_yearly");

  const agentYearlyLive = getStripePriceId({
    role: "agent",
    tier: "pro",
    cadence: "yearly",
    mode: "live",
  });
  assert.equal(agentYearlyLive, "price_agent_yearly_live");

  const plans = listStripePlans();
  assert.ok(plans.length >= 4);

  const mapped = getStripePlanByPriceId("price_agent_monthly");
  assert.equal(mapped?.role, "agent");
  assert.equal(mapped?.cadence, "monthly");
});

void test("stripe price mapping prefers market-aware currency keys before legacy defaults", () => {
  const tenantNgnLive = resolveStripePriceSelection(
    "tenant",
    "tenant_pro",
    "monthly",
    "live",
    "NGN"
  );
  assert.equal(tenantNgnLive.priceId, "price_tenant_monthly_ngn_live");
  assert.equal(
    tenantNgnLive.envKey,
    "STRIPE_PRICE_TENANT_TENANT_PRO_MONTHLY_NGN_LIVE"
  );

  const tenantGbp = resolveStripePriceSelection(
    "tenant",
    "tenant_pro",
    "monthly",
    undefined,
    "GBP"
  );
  assert.equal(tenantGbp.priceId, "price_tenant_monthly_gbp");
  assert.equal(tenantGbp.envKey, "STRIPE_PRICE_TENANT_MONTHLY_GBP");
});

void test("currency-suffixed stripe prices remain discoverable by webhook mapping", () => {
  const mapped = getStripePlanByPriceId("price_tenant_monthly_ngn_live");
  assert.equal(mapped?.role, "tenant");
  assert.equal(mapped?.tier, "tenant_pro");
  assert.equal(mapped?.cadence, "monthly");
  assert.equal(mapped?.currency, "NGN");
});
