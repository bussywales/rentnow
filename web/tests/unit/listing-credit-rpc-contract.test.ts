import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = "/Users/olubusayoadewale/rentnow/web";
const schemaPath = path.join(repoRoot, "supabase", "schema.sql");
const migrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260413183000_listing_credit_cycle_idempotency.sql"
);

void test("listing credit rpc no longer reuses old consumption rows by listing id alone", () => {
  const schema = readFileSync(schemaPath, "utf8");
  const migration = readFileSync(migrationPath, "utf8");

  assert.doesNotMatch(schema, /FROM public\.listing_credit_consumptions\s+WHERE listing_id = in_listing_id\s+LIMIT 1;/);
  assert.doesNotMatch(migration, /FROM public\.listing_credit_consumptions\s+WHERE listing_id = in_listing_id\s+LIMIT 1;/);
  assert.match(migration, /WHERE idempotency_key = in_idempotency_key/);
});
