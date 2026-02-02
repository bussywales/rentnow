import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("support FAQ accordion uses details elements for each item", () => {
  const filePath = path.join(
    process.cwd(),
    "components",
    "support",
    "SupportFaqAccordion.tsx"
  );
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(
    contents.includes("<details"),
    "expected SupportFaqAccordion to render details elements"
  );
  assert.ok(
    contents.includes('data-testid="support-faq"'),
    "expected support FAQ wrapper to expose data-testid"
  );
});
