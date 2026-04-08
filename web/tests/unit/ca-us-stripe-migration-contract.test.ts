import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("CA/US Stripe market migration casts seeded ids to uuid before insert", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260406173000_ca_us_stripe_market_completion.sql"
  );
  const sql = fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ");

  assert.match(
    sql,
    /select\s+seed\.id::uuid,\s+'subscriptions'/i,
    "historical migration must cast seed.id to uuid so fresh environments can apply it"
  );
});

void test("CA/US Stripe market migration still seeds the intended twelve interim rows", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260406173000_ca_us_stripe_market_completion.sql"
  );
  const sql = fs.readFileSync(filePath, "utf8");
  const rowCount = (sql.match(/\('7c9c42b0-a9d6-4f6a-8d11-0000000001\d{2}'/g) ?? [])
    .length;

  assert.equal(rowCount, 12);
  assert.match(sql, /'CA', 'GBP'/);
  assert.match(sql, /'US', 'GBP'/);
});
