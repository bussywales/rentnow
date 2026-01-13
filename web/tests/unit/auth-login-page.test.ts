import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("login page includes forgot password link", () => {
  const loginPath = path.join(process.cwd(), "app", "auth", "login", "page.tsx");
  const contents = fs.readFileSync(loginPath, "utf8");

  assert.ok(contents.includes("Forgot password?"));
  assert.ok(contents.includes("/auth/reset"));
  assert.ok(contents.includes('action="/auth/login"'));
  assert.ok(contents.includes('method="POST"'));
});
