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
  assert.match(source, /select\("plan_tier, valid_until, max_listings_override"\)/);
  assert.match(source, /max_listings_override:\s*maxListingsOverride/);
  assert.match(source, /maxListingsOverride,\s*$/m);
});
