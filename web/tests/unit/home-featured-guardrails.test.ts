import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("home featured listings hides raw errors", () => {
  const pagePath = path.join(process.cwd(), "app", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("We couldn't load featured listings right now."),
    "expected friendly featured listings error copy"
  );
  assert.ok(
    contents.includes("NODE_ENV === \"development\""),
    "expected diagnostics to remain dev-only"
  );
});
