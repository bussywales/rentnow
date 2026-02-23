import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("legacy dashboard leads route redirects to host leads and preserves query/hash", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "leads", "page.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /useSearchParams/);
  assert.match(source, /searchParams\?\.toString\(\)/);
  assert.match(source, /window\.location\.hash/);
  assert.match(source, /window\.location\.replace\(target\)/);
  assert.match(source, /`\/host\/leads\$\{query \? `\?\$\{query\}` : ""\}\$\{hash\}`/);
});
