import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("login route signs in server-side and writes cookies", () => {
  const routePath = path.join(
    process.cwd(),
    "app",
    "auth",
    "login",
    "submit",
    "route.ts"
  );
  const contents = fs.readFileSync(routePath, "utf8");

  assert.ok(contents.includes("signInWithPassword"));
  assert.ok(contents.includes("applyServerAuthCookieDefaults"));
  assert.ok(contents.includes("serializeCookie"));
});
