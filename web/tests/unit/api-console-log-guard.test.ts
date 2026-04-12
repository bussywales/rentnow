import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const routeFiles = [
  "app/api/webhooks/paystack/route.ts",
  "app/api/billing/stripe/webhook/route.ts",
  "app/api/shortlet/bookings/create/route.ts",
  "app/api/shortlet/payments/paystack/verify/route.ts",
  "app/api/shortlet/payments/status/route.ts",
  "app/api/internal/shortlet/reconcile-payments/route.ts",
  "app/api/admin/requests/[id]/route.ts",
];

void test("reviewer hardening sprint removes remaining console.log usage from audited API routes", () => {
  for (const file of routeFiles) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.doesNotMatch(source, /console\.log\(/, `expected ${file} to avoid console.log`);
  }
});
