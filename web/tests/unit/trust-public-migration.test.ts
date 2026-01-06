import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("trust public migration exposes only safe fields", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "031_profile_trust_public_view.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("get_profiles_trust_public"),
    "expected trust public batch function"
  );
  assert.ok(
    contents.includes("email_verified"),
    "expected verification fields"
  );
  assert.ok(
    contents.includes("power_reliability"),
    "expected reliability aliases"
  );
  assert.ok(
    contents.includes("SET row_security = off"),
    "expected row security bypass"
  );

  const disallowedTokens = ["full_name", "avatar_url", "preferred_contact", "areas_served"];
  disallowedTokens.forEach((token) => {
    assert.ok(
      !contents.includes(token),
      `unexpected PII token in migration: ${token}`
    );
  });

  const rlsTokens = ["CREATE POLICY", "DROP POLICY", "ALTER POLICY", "ENABLE ROW LEVEL SECURITY", "FORCE ROW LEVEL SECURITY"];
  rlsTokens.forEach((token) => {
    assert.ok(
      !contents.includes(token),
      `unexpected RLS change token in migration: ${token}`
    );
  });
});
