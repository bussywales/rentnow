import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("home featured listings uses featured-only search copy", () => {
  const pagePath = path.join(process.cwd(), "app", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("Featured homes"),
    "expected updated featured homes heading"
  );
  assert.ok(
    contents.includes("Premium listings from verified advertisers"),
    "expected premium featured homes subcopy"
  );
  assert.ok(
    contents.includes("featured=true"),
    "expected featured-only search param"
  );
  assert.ok(
    !contents.includes("Unable to load featured listings"),
    "expected fallback error copy removed from home page"
  );
});
