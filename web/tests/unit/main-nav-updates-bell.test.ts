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
