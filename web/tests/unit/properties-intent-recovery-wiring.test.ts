import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("properties empty state wires intent recovery CTA card", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.match(contents, /data-testid="intent-recovery-card"/);
  assert.match(contents, /getIntentRecoveryOptions/);
  assert.match(contents, /buildIntentHref/);
  assert.match(contents, /buildClearFiltersHref/);
  assert.match(contents, /Clear filters/);
  assert.match(contents, /sticky top-16/);
});
