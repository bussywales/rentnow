import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("trust snapshot includes admin hosts and excludes tenants", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "037_trust_snapshot_include_admin.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(contents.includes("'admin'"), "expected admin role in trust snapshot");
  assert.ok(contents.includes("'landlord'"), "expected landlord role in trust snapshot");
  assert.ok(contents.includes("'agent'"), "expected agent role in trust snapshot");
  assert.ok(!contents.includes("'tenant'"), "did not expect tenant role in trust snapshot");
});
