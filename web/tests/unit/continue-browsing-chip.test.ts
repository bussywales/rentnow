import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("continue browsing chip uses browse-state hooks with stable testids", () => {
  const sourcePath = path.join(process.cwd(), "components", "viewed", "ContinueBrowsingChip.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid=\{testId\}/);
  assert.match(source, /data-testid=\{`\$\{testId\}-link`\}/);
  assert.match(source, /data-testid=\{`\$\{testId\}-clear`\}/);
  assert.match(source, /setLastBrowseUrl/);
  assert.match(source, /getLastBrowseUrl/);
  assert.match(source, /subscribeLastBrowseUrl/);
  assert.match(source, /clearLastBrowseUrl/);
  assert.match(source, /persistCurrentBrowse/);
});

void test("shortlets and properties mount continue browsing cues", () => {
  const shortletsPath = path.join(
    process.cwd(),
    "components",
    "shortlets",
    "search",
    "ShortletsSearchShell.tsx"
  );
  const shortletsSource = fs.readFileSync(shortletsPath, "utf8");
  assert.match(shortletsSource, /<ContinueBrowsingChip/);
  assert.match(shortletsSource, /kind="shortlet"/);
  assert.match(shortletsSource, /testId="shortlets-continue-browsing-chip"/);

  const propertiesPath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const propertiesSource = fs.readFileSync(propertiesPath, "utf8");
  assert.match(propertiesSource, /<ContinueBrowsingChip/);
  assert.match(propertiesSource, /kind="property"/);
  assert.match(propertiesSource, /testId="properties-continue-browsing-chip"/);
});
