import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("trust public RPC grants include anon", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "036_trust_snapshot_rpc.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("get_trust_snapshot"),
    "expected trust snapshot RPC"
  );
  assert.ok(contents.includes("TO anon"), "expected anon grant");
});
