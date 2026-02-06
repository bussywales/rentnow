import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("agent storefront RPC grants include anon/auth and security definer", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260206123000_agent_storefront_public_grants.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.toLowerCase().includes("security definer"),
    "expected SECURITY DEFINER on storefront RPC"
  );
  assert.ok(
    contents.toLowerCase().includes("grant execute"),
    "expected GRANT EXECUTE on storefront RPC"
  );
  assert.ok(
    contents.toLowerCase().includes("to anon"),
    "expected anon grant on storefront RPC"
  );
});
