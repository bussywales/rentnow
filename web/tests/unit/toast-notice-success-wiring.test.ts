import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("toast notice consumes success query and replaces URL without reload", () => {
  const filePath = path.join(process.cwd(), "components", "layout", "ToastNotice.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.match(contents, /canConsumeSuccessForPath/);
  assert.match(contents, /removeSuccessFromQuery/);
  assert.match(contents, /router\.replace\(.+scroll:\s*false/s);
  assert.match(contents, /setTimeout\(\(\)\s*=>\s*setVisible\(false\),\s*5000\)/);
  assert.match(contents, /<Alert/);
});
