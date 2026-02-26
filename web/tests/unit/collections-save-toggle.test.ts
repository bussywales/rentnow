import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("collections rail source renders save toggles with market context", () => {
  const sourcePath = path.join(process.cwd(), "components", "collections", "CollectionRail.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /import\s+\{\s*SaveToggle\s*\}\s+from\s+"@\/components\/saved\/SaveToggle"/);
  assert.match(source, /import\s+\{\s*TrustBadges\s*\}\s+from\s+"@\/components\/ui\/TrustBadges"/);
  assert.match(source, /marketCountry:\s*string/);
  assert.match(source, /testId=\{`save-toggle-\$\{card\.id\}`\}/);
});

void test("static collections page passes market country into collection rail", () => {
  const sourcePath = path.join(process.cwd(), "app", "collections", "[shareId]", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /<CollectionRail cards=\{cards\} marketCountry=\{market\.country\} \/>/);
});
