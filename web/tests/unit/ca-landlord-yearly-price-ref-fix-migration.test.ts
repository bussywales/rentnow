import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("CA landlord yearly fix migration corrects the active canonical Stripe ref", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260411195500_fix_ca_landlord_yearly_price_ref.sql"
  );
  const sql = fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ");

  assert.match(sql, /market_country = 'CA'/i);
  assert.match(sql, /role = 'landlord'/i);
  assert.match(sql, /cadence = 'yearly'/i);
  assert.match(sql, /active = true/i);
  assert.match(sql, /workflow_state, 'active'\) = 'active'/i);
  assert.match(sql, /currency = 'CAD'/i);
  assert.match(sql, /provider = 'stripe'/i);
  assert.match(sql, /provider_price_ref = 'price_1TKaJfPjtZ0fKtkB7GnRxQWJ'/i);
});
