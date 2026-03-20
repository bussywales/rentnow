import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

void test("paystack server config delegates to billing paystack resolver", () => {
  const source = read("lib/payments/paystack.server.ts");

  assert.match(source, /getPaystackServerConfig as getCanonicalPaystackServerConfig/);
  assert.match(source, /return getCanonicalPaystackServerConfig\(\);/);
});

void test("paystack ops and runtime routes use shared paystack server config helper", () => {
  const files = [
    "app/api/webhooks/paystack/route.ts",
    "app/api/jobs/payments/reconcile/route.ts",
    "app/api/admin/payments/reconcile/route.ts",
    "app/api/payments/featured/initialize/route.ts",
    "app/api/shortlet/payments/paystack/init/route.ts",
    "app/api/shortlet/payments/paystack/verify/route.ts",
  ];

  for (const relativePath of files) {
    const source = read(relativePath);
    assert.match(source, /getPaystackServerConfig/);
    assert.match(source, /hasPaystackServerEnv/);
  }
});
