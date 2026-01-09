import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("rent period migration adds rent_period with check constraint", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "038_properties_rent_period.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("ADD COLUMN IF NOT EXISTS rent_period"),
    "expected rent_period column in migration"
  );
  assert.ok(
    contents.includes("rent_period IN ('monthly', 'yearly')"),
    "expected rent_period check constraint in migration"
  );
});
