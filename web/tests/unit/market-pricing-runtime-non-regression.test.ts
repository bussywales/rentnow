import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

void test("market pricing admin edit batch does not switch checkout or enforcement runtime to the new tables", () => {
  const checkoutRoute = read("app/api/billing/checkout/route.ts");
  const entitlementServer = read("lib/billing/listing-publish-entitlement.server.ts");
  const planEnforcement = read("lib/plan-enforcement.ts");
  const paygConfig = read("lib/billing/payg.ts");
  const listingSubmitRoute = read("app/api/properties/[id]/submit/route.ts");
  const canadaRuntimeAdapter = read("lib/billing/canada-payg-runtime.server.ts");

  for (const source of [checkoutRoute, entitlementServer, planEnforcement, paygConfig, listingSubmitRoute]) {
    assert.doesNotMatch(source, /market_billing_policies/);
    assert.doesNotMatch(source, /market_listing_entitlements/);
    assert.doesNotMatch(source, /market_one_off_price_book/);
    assert.doesNotMatch(source, /loadAdminMarketPricingControlPlane/);
  }

  assert.match(checkoutRoute, /canada-payg-runtime/);
  assert.match(listingSubmitRoute, /canada-payg-runtime/);
  assert.doesNotMatch(checkoutRoute, /resolveCanadaRentalPaygReadiness/);
  assert.doesNotMatch(checkoutRoute, /canada-payg-readiness/);
  assert.doesNotMatch(listingSubmitRoute, /resolveCanadaRentalPaygReadiness/);
  assert.doesNotMatch(listingSubmitRoute, /canada-payg-readiness/);
  assert.match(canadaRuntimeAdapter, /resolveCanadaRentalPaygReadiness/);

  assert.match(checkoutRoute, /z\.enum\(\["listing_submission", "featured_listing"\]\)/);
  assert.match(planEnforcement, /max_listings_override/);
  assert.match(paygConfig, /DEFAULT_PAYG_CURRENCY/);
});
