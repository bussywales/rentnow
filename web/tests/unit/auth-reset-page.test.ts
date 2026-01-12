import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("reset page renders reset copy", () => {
  const resetPath = path.join(process.cwd(), "app", "auth", "reset", "page.tsx");
  const contents = fs.readFileSync(resetPath, "utf8");

  assert.ok(contents.includes("Reset your password"));
  assert.ok(contents.includes("resetPasswordForEmail"));
  assert.ok(contents.includes("exchangeCodeForSession"));
  assert.ok(contents.includes("setSession"));
  assert.ok(contents.includes("onAuthStateChange"));
  assert.ok(contents.includes("PASSWORD_RECOVERY"));
  assert.ok(contents.includes("from=reset_email"));
});
