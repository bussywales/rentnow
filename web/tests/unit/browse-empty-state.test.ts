import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("browse empty state does not treat zero results as error", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    !contents.includes("API returned 0 properties"),
    "did not expect zero-results error string"
  );
  assert.ok(
    contents.includes("NODE_ENV === \"development\""),
    "expected diagnostics to be gated to development only"
  );
  assert.ok(
    contents.includes("No properties found"),
    "expected an empty-state title for zero results"
  );
  assert.ok(
    contents.includes("Unable to load homes"),
    "expected a distinct fetch error title"
  );
});
