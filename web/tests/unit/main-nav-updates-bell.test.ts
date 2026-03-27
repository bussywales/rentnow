import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("main nav renders product updates bell in the top action cluster", () => {
  const filePath = path.join(process.cwd(), "components", "layout", "MainNav.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /import\s+\{\s*ProductUpdatesBell\s*\}\s+from\s+"@\/components\/updates\/ProductUpdatesBell"/);
  assert.match(source, /<ProductUpdatesBell\s+initialAuthed=\{initialAuthed\}\s*\/>/);
});

void test("product updates header control uses announcement copy instead of a second notification bell label", () => {
  const filePath = path.join(process.cwd(), "components", "updates", "ProductUpdatesBell.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /aria-label="Open updates"/);
  assert.match(source, /d="M4\.75 10\.25v3\.5A1\.25 1\.25 0 0 0 6 15h2\.15l1\.65 4\.1/);
  assert.equal(source.includes('aria-label="Product updates"'), false);
});
