import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

void test("market pricing v2 migration adds role/tier-aware one-off pricing and safe Canada planning rows", () => {
  const sql = read("supabase/migrations/20260504162000_market_pricing_one_off_role_tier_v2.sql");

  assert.match(sql, /add column if not exists role text/i);
  assert.match(sql, /add column if not exists tier text/i);
  assert.match(sql, /market_one_off_price_book_role_check/i);
  assert.match(sql, /market_one_off_price_book_tier_check/i);
  assert.match(sql, /market_one_off_price_book_role_tier_check/i);
  assert.match(sql, /role is null and tier is null/i);
  assert.match(sql, /role = 'agent' and tier in \('free', 'starter', 'pro', 'enterprise'\)/i);

  assert.match(sql, /drop index if exists public\.market_one_off_price_book_active_key_unique/i);
  assert.match(sql, /coalesce\(role, '__all__'\)/i);
  assert.match(sql, /coalesce\(tier, '__all__'\)/i);
  assert.match(sql, /market_one_off_price_book_role_tier_idx/i);

  assert.match(sql, /'CA'/i);
  assert.match(sql, /'CAD'/i);
  assert.match(sql, /'stripe'/i);
  assert.match(sql, /'landlord'/i);
  assert.match(sql, /'agent'/i);
  assert.match(sql, /'enterprise'/i);
  assert.match(sql, /planning row only/i);
  assert.match(sql, /does not enable checkout or runtime pricing/i);
  assert.match(sql, /Enterprise is not a runtime tier yet/i);
  assert.match(sql, /featured_listing_30d/i);
  assert.match(sql, /false,\s*\n\s*null,\s*\n\s*false/i);
});
