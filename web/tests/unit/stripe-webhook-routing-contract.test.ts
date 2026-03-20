import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

void test("billing stripe webhook route uses billing-scoped webhook config", () => {
  const source = readFileSync(
    join(process.cwd(), "app/api/billing/stripe/webhook/route.ts"),
    "utf8"
  );
  assert.match(source, /getStripeConfigForMode\(stripeMode,\s*"billing"\)/);
});

void test("shortlet stripe webhook route uses shortlet-scoped webhook config", () => {
  const source = readFileSync(
    join(process.cwd(), "app/api/webhooks/stripe/route.ts"),
    "utf8"
  );
  assert.match(source, /getStripeConfigForMode\(modes\.stripeMode,\s*"shortlet"\)/);
});
