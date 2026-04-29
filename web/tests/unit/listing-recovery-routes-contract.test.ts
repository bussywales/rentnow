import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildListingMonetizationResumeUrl } from "@/lib/billing/listing-publish-entitlement.server";
import { buildActiveListingLimitRecoveryPayload } from "@/lib/plan-enforcement";

const read = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

void test("payment and billing recovery resumes on canonical host edit submit step", () => {
  const resumeUrl = buildListingMonetizationResumeUrl({
    propertyId: "listing-123",
    reason: "PAYMENT_REQUIRED",
    context: "renewal",
    amount: 2000,
    currency: "NGN",
  });

  assert.equal(
    resumeUrl,
    "/host/properties/listing-123/edit?step=submit&monetization=payment_required&monetization_context=renewal&monetization_amount=2000&monetization_currency=NGN"
  );
});

void test("listing-limit recovery resumes on canonical host edit and manages canonical listings", () => {
  const recovery = buildActiveListingLimitRecoveryPayload({
    gate: {
      ok: false,
      code: "plan_limit_reached",
      planTier: "starter",
      maxListings: 5,
      activeCount: 5,
      usage: {
        plan: {
          tier: "starter",
          name: "Starter",
          maxListings: 5,
          featuredListing: false,
          instantApproval: false,
        },
        activeCount: 5,
        source: "service",
      },
    },
    requesterRole: "landlord",
    context: "submission",
    propertyId: "listing-123",
  });

  assert.equal(recovery.manageUrl, "/host/listings?view=manage");
  assert.match(recovery.resumeUrl ?? "", /^\/host\/properties\/listing-123\/edit\?/);
  assert.match(recovery.resumeUrl ?? "", /monetization=listing_limit/);
  assert.match(recovery.resumeUrl ?? "", /monetization_context=submission/);
});

void test("pay-per-listing checkout callback returns to host edit payment resume path", () => {
  const source = read("app/api/billing/checkout/route.ts");

  assert.match(source, /buildHostPropertyEditHref\(listingId, \{ payment: "payg" \}\)/);
  assert.doesNotMatch(source, /\/dashboard\/properties\/\$\{listingId\}\?payment=payg/);
});
