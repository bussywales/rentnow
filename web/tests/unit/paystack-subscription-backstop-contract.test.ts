import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

void test("paystack verify route delegates subscription finalization to the shared helper", () => {
  const source = read("app/api/billing/paystack/verify/route.ts");

  assert.match(source, /finalizePaystackSubscriptionEvent/);
  assert.match(source, /getPaystackSubscriptionEventByReference/);
});

void test("billing paystack webhook uses the shared subscription backstop helper", () => {
  const source = read("app/api/billing/webhook/route.ts");

  assert.match(source, /getPaystackSubscriptionEventByReference/);
  assert.match(source, /finalizePaystackSubscriptionEvent/);
  assert.match(source, /subscription: true/);
});
