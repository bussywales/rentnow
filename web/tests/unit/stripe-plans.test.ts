import test from "node:test";
import assert from "node:assert/strict";

import { getStripePlanByPriceId, getStripePriceId, listStripePlans } from "../../lib/billing/stripe-plans";

process.env.STRIPE_PRICE_LANDLORD_MONTHLY = "price_landlord_monthly";
process.env.STRIPE_PRICE_LANDLORD_YEARLY = "price_landlord_yearly";
process.env.STRIPE_PRICE_AGENT_MONTHLY = "price_agent_monthly";
process.env.STRIPE_PRICE_AGENT_YEARLY = "price_agent_yearly";

void test("stripe plan mapping resolves price ids", () => {
  const landlordMonthly = getStripePriceId({
    role: "landlord",
    tier: "starter",
    cadence: "monthly",
  });
  assert.equal(landlordMonthly, "price_landlord_monthly");

  const agentYearly = getStripePriceId({
    role: "agent",
    tier: "pro",
    cadence: "yearly",
  });
  assert.equal(agentYearly, "price_agent_yearly");

  const plans = listStripePlans();
  assert.ok(plans.length >= 4);

  const mapped = getStripePlanByPriceId("price_agent_monthly");
  assert.equal(mapped?.role, "agent");
  assert.equal(mapped?.cadence, "monthly");
});
