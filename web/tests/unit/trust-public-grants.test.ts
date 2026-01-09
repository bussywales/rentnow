import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("trust public RPC grants include anon", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "035_trust_public_rpc_grants.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("get_profiles_trust_public"),
    "expected batch trust RPC grant"
  );
  assert.ok(contents.includes("TO anon"), "expected anon grant");
});
