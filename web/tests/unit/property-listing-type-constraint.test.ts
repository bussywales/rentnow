import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("latest properties listing_type constraint includes condo", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260411233000_properties_listing_type_condo.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.match(contents, /'condo'/);
  assert.match(contents, /properties_listing_type_check/);
});
