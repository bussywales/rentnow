import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("save toggle source keeps accessibility labels and state markers", () => {
  const sourcePath = path.join(process.cwd(), "components", "saved", "SaveToggle.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid=\{testId\}/);
  assert.match(source, /data-saved=\{saved \? "true" : "false"\}/);
  assert.match(source, /const labelTarget = title\?\.trim\(\) \|\| "item"/);
  assert.match(source, /aria-label=\{saved \? `Unsave \$\{labelTarget\}` : `Save \$\{labelTarget\}`\}/);
  assert.match(source, /aria-pressed=\{saved\}/);
  assert.match(source, /toggleSavedItem\(/);
  assert.match(source, /subscribeSavedItems\(/);
});
