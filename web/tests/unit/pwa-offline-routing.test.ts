import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("service worker offline fallback preserves route context via from param", () => {
  const swPath = path.join(process.cwd(), "public", "sw.js");
  const source = fs.readFileSync(swPath, "utf8");

  assert.match(source, /const OFFLINE_QUERY_PARAM = "from";/);
  assert.match(source, /buildOfflinePathWithFrom\(url\)/);
  assert.match(source, /Response\.redirect\(buildOfflinePathWithFrom\(url\), 302\)/);
  assert.match(source, /caches\.match\(request, \{ ignoreSearch: true \}\)/);
});
