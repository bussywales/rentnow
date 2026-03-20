import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const webRoot = process.cwd();
const repoRoot = path.resolve(webRoot, "..");

function readFromRepo(relPath: string) {
  return readFileSync(path.join(repoRoot, relPath), "utf8");
}

function readFromWeb(relPath: string) {
  return readFileSync(path.join(webRoot, relPath), "utf8");
}

test("featured payments decision doc defines canonical and secondary lanes", () => {
  const source = readFromRepo("docs/product/FEATURED_PAYMENTS_CANONICAL_MODEL.md");
  assert.match(source, /canonical featured-payment model is:\n\n- `payments` \+ `featured_purchases`/);
  assert.match(source, /`feature_purchases` remains an active but secondary lane/i);
});

test("admin payments page scopes canonical lane and legacy payg lane separately", () => {
  const source = readFromWeb("app/admin/payments/page.tsx");
  assert.match(source, /Canonical featured activation payments/);
  assert.match(source, /Legacy PAYG featured listing charges/);
  assert.match(source, /fetchAdminLegacyFeaturePurchases/);
  assert.match(source, /feature_purchases/);
});

test("featured payments helper exposes legacy payg admin query", () => {
  const source = readFromWeb("lib/payments/featured-payments.server.ts");
  assert.match(source, /export async function fetchAdminLegacyFeaturePurchases/);
  assert.match(source, /from\("feature_purchases"\)/);
  assert.match(source, /properties\(id,title,city\)/);
});

test("featured payments runbooks clarify canonical scope", () => {
  const paystackRunbook = readFromWeb("docs/payments-v1-paystack.md");
  const opsRunbook = readFromWeb("docs/payments-v1-ops-vercel-cron.md");
  assert.match(paystackRunbook, /canonical v1 payments flow for approved Featured request activations/i);
  assert.match(opsRunbook, /canonical Paystack featured activation payments lane/i);
});
