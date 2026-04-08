import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const nextConfigPath = path.join(process.cwd(), "next.config.ts");

void test("next config defines baseline security headers without shipping a CSP", () => {
  const contents = fs.readFileSync(nextConfigPath, "utf8");

  assert.match(contents, /X-Frame-Options/);
  assert.match(contents, /DENY/);
  assert.match(contents, /X-Content-Type-Options/);
  assert.match(contents, /nosniff/);
  assert.match(contents, /Referrer-Policy/);
  assert.match(contents, /strict-origin-when-cross-origin/);
  assert.match(contents, /Permissions-Policy/);
  assert.doesNotMatch(contents, /Content-Security-Policy/);
});
