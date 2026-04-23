import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const stepperPath = path.join(
  process.cwd(),
  "components",
  "properties",
  "PropertyStepper.tsx"
);
const renewButtonPath = path.join(
  process.cwd(),
  "components",
  "host",
  "RenewListingButton.tsx"
);
const paywallModalPath = path.join(
  process.cwd(),
  "components",
  "billing",
  "ListingPaywallModal.tsx"
);

void test("property stepper routes blocked listing flows to billing and explicit save/exit copy", () => {
  const source = readFileSync(stepperPath, "utf8");
  assert.match(source, /Continue to billing/);
  assert.match(source, /Save and exit/);
  assert.match(source, /\/dashboard\/billing#plans/);
  assert.doesNotMatch(source, /router\.push\(\"\/pricing\"\)/);
});

void test("property stepper supports listing-limit recovery with plans and manage-listings copy", () => {
  const source = readFileSync(stepperPath, "utf8");
  const modalSource = readFileSync(paywallModalPath, "utf8");
  assert.match(source, /monetizationReason === "listing_limit"/);
  assert.match(source, /Manage listings/);
  assert.match(source, /mode=\{monetizationNeedsLimitRecovery \? "listing_limit" : "listing"\}/);
  assert.match(source, /trackingDedupeKey=\{propertyId \? `listing-limit:\$\{propertyId\}` : "listing-limit:unknown"\}/);
  assert.match(modalSource, /listing_limit_recovery_viewed/);
  assert.match(modalSource, /listing_limit_recovery_cta_clicked/);
  assert.match(modalSource, /view_plans/);
  assert.match(modalSource, /manage_listings/);
});

void test("renew listing button forwards blocked responses into the monetization resume path", () => {
  const source = readFileSync(renewButtonPath, "utf8");
  assert.match(source, /data\?\.resumeUrl/);
  assert.match(source, /router\.push/);
});
