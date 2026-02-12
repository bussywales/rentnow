import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("workspace home hides featured rail when there are no featured homes", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.match(
    contents,
    /featuredListingsEnabled && featuredHomes\.length > 0/,
    "expected featured section to be conditional on available featured homes"
  );
});
