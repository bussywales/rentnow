import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("country code backfill is idempotent and guarded", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "041_backfill_properties_country_code.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("UPDATE public.properties"),
    "expected backfill update statement"
  );
  assert.ok(
    contents.includes("country_code IS NULL"),
    "expected backfill to avoid overwriting existing codes"
  );
  assert.ok(
    contents.includes("country IS NOT NULL"),
    "expected backfill to require country values"
  );
  assert.ok(
    contents.includes("lower(btrim(p.country))"),
    "expected backfill to normalize country names"
  );
});
