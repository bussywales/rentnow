import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("explore v2 cta copy variant migration adds storage column and allowed values", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260313120000_explore_v2_cta_copy_variant.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.match(contents, /ADD COLUMN IF NOT EXISTS cta_copy_variant TEXT/);
  assert.match(contents, /explore_events_cta_copy_variant_check/);
  assert.match(contents, /'default'/);
  assert.match(contents, /'clarity'/);
  assert.match(contents, /'action'/);
  assert.match(contents, /'explore_v2_cta_copy_variant'/);
});
