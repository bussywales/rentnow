import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin system page includes pwa installability diagnostics section", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "system", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /PWA installability diagnostics/);
  assert.match(source, /\/manifest\.webmanifest/);
  assert.match(source, /\/\?source=pwa/);
  assert.match(source, /\/sw\.js/);
  assert.match(source, /How to verify install/);
});
