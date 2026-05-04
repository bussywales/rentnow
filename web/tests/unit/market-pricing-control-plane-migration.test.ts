import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

void test("market pricing control plane migration creates gated tables, indexes, triggers, and safe Canada seeds", () => {
  const sql = read("supabase/migrations/20260504113000_market_pricing_control_plane_v1.sql");

  assert.match(sql, /create table if not exists public\.market_billing_policies/i);
  assert.match(sql, /create table if not exists public\.market_listing_entitlements/i);
  assert.match(sql, /create table if not exists public\.market_one_off_price_book/i);
  assert.match(sql, /create table if not exists public\.market_pricing_audit_log/i);

  assert.match(sql, /alter table public\.market_billing_policies enable row level security/i);
  assert.match(sql, /alter table public\.market_listing_entitlements enable row level security/i);
  assert.match(sql, /alter table public\.market_one_off_price_book enable row level security/i);
  assert.match(sql, /alter table public\.market_pricing_audit_log enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /public\.is_admin\(\)/i);

  assert.match(sql, /market_billing_policies_active_market_unique/i);
  assert.match(sql, /market_listing_entitlements_active_key_unique/i);
  assert.match(sql, /market_one_off_price_book_active_key_unique/i);
  assert.match(sql, /market_billing_policies_state_idx/i);
  assert.match(sql, /market_one_off_price_book_product_idx/i);
  assert.match(sql, /market_listing_entitlements_role_tier_idx/i);

  assert.match(sql, /market_billing_policies_touch_updated_at/i);
  assert.match(sql, /market_listing_entitlements_touch_updated_at/i);
  assert.match(sql, /market_one_off_price_book_touch_updated_at/i);
  assert.match(sql, /execute function public\.touch_updated_at\(\)/i);

  assert.match(sql, /'CA'/i);
  assert.match(sql, /'CAD'/i);
  assert.match(sql, /'draft'/i);
  assert.match(sql, /'Canada PAYG and market entitlements remain policy-gated/i);
  assert.match(sql, /payg_listing_enabled,\s*featured_listing_enabled,\s*subscription_checkout_enabled/i);
  assert.match(sql, /false,\s*false,\s*false,\s*'stripe'/i);

  assert.match(sql, /'NG'/i);
  assert.match(sql, /'listing_submission'/i);
  assert.match(sql, /'featured_listing_7d'/i);
  assert.match(sql, /'featured_listing_30d'/i);
  assert.match(sql, /legacy settings\/code constants/i);
});
