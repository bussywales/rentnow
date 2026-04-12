import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("auth session resolution no longer relies on an unknown cast for Supabase auth", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib", "auth.ts"), "utf8");

  assert.doesNotMatch(source, /as unknown as SupabaseAuthLike/);
  assert.match(source, /type SupabaseAuthLike = Pick</);
  assert.match(source, /resolveSessionUserFromSupabase\(supabase\)/);
});
