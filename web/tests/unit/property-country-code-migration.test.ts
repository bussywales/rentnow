import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("properties country_code migration adds column and check constraint", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "040_properties_country_code.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("country_code TEXT"),
    "expected country_code column in migration"
  );
  assert.ok(
    contents.includes("properties_country_code_check"),
    "expected country_code check constraint in migration"
  );
});
