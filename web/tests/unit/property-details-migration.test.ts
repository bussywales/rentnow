import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("listing details migration adds property detail columns", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "039_properties_listing_details.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("listing_type"),
    "expected listing_type column in migration"
  );
  assert.ok(
    contents.includes("state_region"),
    "expected state_region column in migration"
  );
  assert.ok(
    contents.includes("size_value"),
    "expected size_value column in migration"
  );
  assert.ok(
    contents.includes("size_unit"),
    "expected size_unit column in migration"
  );
  assert.ok(
    contents.includes("year_built"),
    "expected year_built column in migration"
  );
  assert.ok(
    contents.includes("deposit_amount"),
    "expected deposit_amount column in migration"
  );
  assert.ok(
    contents.includes("deposit_currency"),
    "expected deposit_currency column in migration"
  );
  assert.ok(
    contents.includes("bathroom_type"),
    "expected bathroom_type column in migration"
  );
  assert.ok(
    contents.includes("pets_allowed"),
    "expected pets_allowed column in migration"
  );
});
