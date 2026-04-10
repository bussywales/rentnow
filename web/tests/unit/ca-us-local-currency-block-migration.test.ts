import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("CA/US local-currency block migration marks interim Stripe rows as blocked pending local prices", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260409173000_ca_us_local_currency_block.sql"
  );
  const sql = fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ");

  assert.match(sql, /update public\.subscription_price_book/i);
  assert.match(sql, /badge = 'Blocked'/i);
  assert.match(sql, /Blocked until real CAD recurring Stripe prices are created and linked for Canada\./i);
  assert.match(sql, /Blocked until real USD recurring Stripe prices are created and linked for the United States\./i);
});
