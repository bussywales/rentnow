import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("trust markers migration adds verification columns", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "030_profile_trust_markers.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("email_verified"),
    "expected email_verified column in migration"
  );
  assert.ok(
    contents.includes("phone_verified"),
    "expected phone_verified column in migration"
  );
  assert.ok(
    contents.includes("bank_verified"),
    "expected bank_verified column in migration"
  );
});
