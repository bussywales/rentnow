import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("CA/US local-currency completion migration rewires all canonical Stripe rows to CAD/USD refs", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260411103000_ca_us_local_currency_stripe_completion.sql"
  );
  const sql = fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ");

  assert.match(sql, /update public\.subscription_price_book as book/i);
  assert.match(sql, /'CA', 'tenant', 'tenant_pro', 'monthly', 'CAD', 999, 'price_1TKaEcPjtZ0fKtkBYl45ZvF0'/i);
  assert.match(sql, /'CA', 'tenant', 'tenant_pro', 'yearly', 'CAD', 9900, 'price_1TKaFCPjtZ0fKtkBWKJArOEU'/i);
  assert.match(sql, /'CA', 'landlord', 'pro', 'monthly', 'CAD', 1999, 'price_1TKaJDPjtZ0fKtkBISh35BGf'/i);
  assert.match(sql, /'CA', 'landlord', 'pro', 'yearly', 'CAD', 19900, 'price_1TKaJfPjtZ0fKtkB7GnRxQWJ'/i);
  assert.match(sql, /'CA', 'agent', 'pro', 'monthly', 'CAD', 4999, 'price_1TKaUKPjtZ0fKtkBR72YdK8H'/i);
  assert.match(sql, /'CA', 'agent', 'pro', 'yearly', 'CAD', 49900, 'price_1TKaUoPjtZ0fKtkBEK9hmPSq'/i);
  assert.match(sql, /'US', 'tenant', 'tenant_pro', 'monthly', 'USD', 999, 'price_1TKaGbPjtZ0fKtkBqRESXfcm'/i);
  assert.match(sql, /'US', 'tenant', 'tenant_pro', 'yearly', 'USD', 9900, 'price_1TKaGwPjtZ0fKtkBxC84foEX'/i);
  assert.match(sql, /'US', 'landlord', 'pro', 'monthly', 'USD', 1999, 'price_1TKaK0PjtZ0fKtkBvMrNwDOn'/i);
  assert.match(sql, /'US', 'landlord', 'pro', 'yearly', 'USD', 19900, 'price_1TKaKXPjtZ0fKtkBCDLk8uah'/i);
  assert.match(sql, /'US', 'agent', 'pro', 'monthly', 'USD', 4999, 'price_1TKaVBPjtZ0fKtkBtyUMIh0C'/i);
  assert.match(sql, /'US', 'agent', 'pro', 'yearly', 'USD', 49900, 'price_1TKaVTPjtZ0fKtkB3Df0WQbo'/i);
  assert.match(sql, /badge = null/i);
});
