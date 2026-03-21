import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

void test("paystack webhook routes validate signatures with the resolved webhook secret", () => {
  const paymentsWebhookSource = read("app/api/webhooks/paystack/route.ts");
  const billingWebhookSource = read("app/api/billing/webhook/route.ts");

  assert.match(paymentsWebhookSource, /secret:\s*paystackConfig\.webhookSecret/);
  assert.match(billingWebhookSource, /createHmac\("sha512", config\.webhookSecret \|\| ""\)/);
});

void test("billing page keeps flutterwave checkout hidden from the self-serve plans grid", () => {
  const billingPageSource = read("app/dashboard/billing/page.tsx");
  const plansGridSource = read("components/billing/PlansGrid.tsx");

  assert.match(billingPageSource, /const flutterwaveCheckoutVisible = false;/);
  assert.match(plansGridSource, /flutterwaveCheckoutVisible\?: boolean;/);
  assert.match(plansGridSource, /onFlutterwave=\{\s*flutterwaveCheckoutVisible/);
});
