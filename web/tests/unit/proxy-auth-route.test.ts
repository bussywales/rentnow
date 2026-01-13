import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("proxy auth route avoids clearing auth cookies on auth failures", () => {
  const filePath = path.join(
    process.cwd(),
    "app",
    "proxy",
    "auth",
    "route.ts"
  );
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("shouldSuppressAuthCookieClear"));
  assert.ok(contents.includes("selectAuthCookieValueFromHeader"));
});
