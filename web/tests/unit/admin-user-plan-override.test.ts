import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin user drawer plan override posts through billing actions with required reason", () => {
  const filePath = path.join(process.cwd(), "components", "admin", "AdminUserActions.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /fetch\("\/api\/admin\/billing\/actions"/);
  assert.match(source, /action:\s*"set_plan_tier"/);
  assert.match(source, /setPlanMessage\("Reason is required for plan changes\."\)/);
  assert.match(source, /data-testid="admin-user-plan-reason"/);
});

void test("admin billing actions route persists max listings override for set plan tier", () => {
  const filePath = path.join(process.cwd(), "app", "api", "admin", "billing", "actions", "route.ts");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /maxListingsOverride:\s*z\.number\(\)\.int\(\)\.positive\(\)\.max\(1_000\)\.nullable\(\)\.optional\(\)/);
  assert.match(source, /plan_tier, valid_until, max_listings_override/);
  assert.match(source, /max_listings_override:\s*maxListingsOverride/);
  assert.match(source, /maxListingsOverride,\s*$/m);
});

void test("admin billing ops supports returning manual overrides to Stripe billing", () => {
  const actionsRoutePath = path.join(process.cwd(), "app", "api", "admin", "billing", "actions", "route.ts");
  const routeSource = fs.readFileSync(actionsRoutePath, "utf8");
  assert.match(routeSource, /action:\s*z\.literal\("return_to_provider_billing"\)/);
  assert.match(routeSource, /action:\s*z\.literal\("reset_billing_test_account"\)/);
  assert.match(routeSource, /restoreStripeProviderBilling/);
  assert.match(routeSource, /resetBillingTestAccount/);
  assert.match(routeSource, /restoredBillingSource:\s*"stripe"/);

  const actionsComponentPath = path.join(process.cwd(), "components", "admin", "BillingOpsActions.tsx");
  const componentSource = fs.readFileSync(actionsComponentPath, "utf8");
  assert.match(componentSource, /Return to Stripe billing/);
  assert.match(componentSource, /Reset billing test account/);
  assert.match(componentSource, /action:\s*"return_to_provider_billing"/);
  assert.match(componentSource, /action:\s*"reset_billing_test_account"/);
  assert.match(componentSource, /Reason is required to return billing to the provider\./);
  assert.match(componentSource, /Reason is required to reset a billing test account\./);
  assert.match(componentSource, /Refresh billing snapshot/);
  assert.match(componentSource, /Replay Stripe event/);
  assert.match(componentSource, /Reason is required to replay a Stripe event\./);
});

void test("stripe replay route now requires a reason and records replay notes", () => {
  const routePath = path.join(process.cwd(), "app", "api", "admin", "billing", "stripe", "replay", "route.ts");
  const source = fs.readFileSync(routePath, "utf8");

  assert.match(source, /reason is required/);
  assert.match(source, /Support action: stripe_replay/);
  assert.match(source, /profile_billing_notes/);
});
