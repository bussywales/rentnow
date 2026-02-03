import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("rls policies use admin helper and hardened checks", () => {
  const rlsPath = path.join(process.cwd(), "supabase", "rls_policies.sql");
  const contents = fs.readFileSync(rlsPath, "utf8");

  assert.ok(
    contents.includes("CREATE OR REPLACE FUNCTION public.is_admin"),
    "expected is_admin helper"
  );

  assert.ok(
    contents.includes('CREATE POLICY "support requests insert"'),
    "expected support requests insert policy"
  );
  assert.ok(
    contents.includes("WITH CHECK (user_id IS NULL OR auth.uid() = user_id)"),
    "expected support requests insert to gate user_id"
  );

  assert.ok(
    contents.includes('CREATE POLICY "app_settings_read"'),
    "expected app_settings_read policy"
  );
  assert.ok(
    contents.includes("auth.role() = 'authenticated'") &&
      contents.includes("auth.role() = 'anon'"),
    "expected explicit role check for app_settings_read"
  );
});
