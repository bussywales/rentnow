import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

void test("subscription price book migration seeds official UK pricing truth", () => {
  const migration = read("supabase/migrations/20260330153000_subscription_price_book_v1.sql");

  assert.match(migration, /create table if not exists public\.subscription_price_book/i);
  assert.match(migration, /'GB',\s*'GBP',\s*999,/);
  assert.match(migration, /'GB',\s*'GBP',\s*8999,/);
  assert.match(migration, /'GB',\s*'GBP',\s*1999,/);
  assert.match(migration, /'GB',\s*'GBP',\s*18999,/);
  assert.match(migration, /'GB',\s*'GBP',\s*3999,/);
  assert.match(migration, /'GB',\s*'GBP',\s*38999,/);
});

void test("admin billing prices page is wired to the canonical matrix loader", () => {
  const source = read("app/admin/settings/billing/prices/page.tsx");

  assert.match(source, /loadAdminSubscriptionPriceMatrix/);
  assert.match(source, /parseAdminSubscriptionPriceMatrixFilters/);
  assert.match(source, /subscription_price_book/);
  assert.match(source, /Runtime checkout/);
  assert.match(source, /Checkout mismatches/);
});
